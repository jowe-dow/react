# 04. Diff 算法（Reconciliation）

> 源码文件：`packages/react-reconciler/src/ReactChildFiber.js`

## 概述

**学习目标**：
- 理解 React Diff 算法的三个前提假设（降低复杂度从 O(n³) 到 O(n)）
- 掌握单节点 Diff 和多节点 Diff 的完整流程
- 理解 `lastPlacedIndex` 算法如何最小化 DOM 移动操作
- 对比 React Diff 与 Vue 3 最长递增子序列（LIS）算法的差异

---

## 三个假设前提

React Diff 不追求"最优解"，而是基于以下假设做"足够好的解"：

1. **不同类型的元素产生不同的树**：`<div>` 变为 `<span>` → 直接销毁重建整棵子树
2. **key 是兄弟节点中的唯一标识**：相同 key 的节点可以复用
3. **同层级对比**：只比较同一层级的节点，不跨层级比较

这将复杂度从理论上的 O(n³) 降低为 O(n)。

---

## 入口函数

**源码位置**：`packages/react-reconciler/src/ReactChildFiber.js` L2028

```js
function reconcileChildFibers(
  returnFiber: Fiber,       // 父 Fiber
  currentFirstChild: Fiber | null,  // 当前 current tree 的第一个子节点
  newChild: any,            // 新的 React 元素（JSX 返回值）
  lanes: Lanes,
): Fiber | null {
  thenableIndexCounter = 0;
  const firstChildFiber = reconcileChildFibersImpl(
    returnFiber,
    currentFirstChild,
    newChild,
    lanes,
  );
  thenableState = null;
  return firstChildFiber;
}
```

`reconcileChildFibersImpl`（L1849）根据 `newChild` 类型分发：

```js
function reconcileChildFibersImpl(...) {
  // 处理特殊情况：Fragment、Lazy 等
  if (typeof newChild === 'object' && newChild !== null) {
    switch (newChild.$$typeof) {
      case REACT_ELEMENT_TYPE:
        // 单个 React 元素
        return placeSingleChild(
          reconcileSingleElement(returnFiber, currentFirstChild, newChild, lanes)
        );
      case REACT_PORTAL_TYPE:
        return placeSingleChild(reconcileSinglePortal(...));
      case REACT_LAZY_TYPE:
        // lazy 组件...
    }

    if (isArray(newChild)) {
      // 数组（最常见的多节点情况）
      return reconcileChildrenArray(returnFiber, currentFirstChild, newChild, lanes);
    }
  }

  if (typeof newChild === 'string' || typeof newChild === 'number') {
    // 文本节点
    return placeSingleChild(reconcileSingleTextNode(...));
  }

  // newChild 为 null/undefined/boolean → 删除所有旧节点
  return deleteRemainingChildren(returnFiber, currentFirstChild);
}
```

---

## 单节点 Diff

当新的 children 只有一个元素时，调用 `reconcileSingleElement`：

```js
function reconcileSingleElement(
  returnFiber: Fiber,
  currentFirstChild: Fiber | null,
  element: ReactElement,
  lanes: Lanes,
): Fiber {
  const key = element.key;
  let child = currentFirstChild;

  // 遍历所有旧子节点，寻找可以复用的
  while (child !== null) {
    if (child.key === key) {
      // key 相同，进一步检查 type
      const elementType = element.type;

      if (child.elementType === elementType) {
        // key 和 type 都相同 → 复用这个 Fiber！
        // 删除其余兄弟节点
        deleteRemainingChildren(returnFiber, child.sibling);
        // 克隆并返回复用的 Fiber
        const existing = useFiber(child, element.props);
        existing.ref = coerceRef(returnFiber, child, element);
        existing.return = returnFiber;
        return existing;
      }

      // key 相同但 type 不同 → 删除旧节点（及所有兄弟），创建新的
      deleteRemainingChildren(returnFiber, child);
      break;
    } else {
      // key 不同 → 删除这个旧节点，继续找
      deleteChild(returnFiber, child);
    }
    child = child.sibling;
  }

  // 没找到可复用的，创建新的 Fiber
  const created = createFiberFromElement(element, returnFiber.mode, lanes);
  created.ref = coerceRef(returnFiber, currentFirstChild, element);
  created.return = returnFiber;
  return created;
}
```

**决策流程图**：

```
新子节点（单个）
      │
      ▼
遍历旧子节点链表
      │
      ├─ key 相同 ──┬─ type 相同 → 复用，删除其余兄弟
      │             └─ type 不同 → 删除所有旧节点，创建新节点
      │
      └─ key 不同 → 删除此旧节点，继续遍历
                          │
                   没有更多旧节点 → 创建新节点
```

**实例分析**：

```jsx
// 旧：<div key="a"><div key="b" /><span key="c" /></div>
// 新：<div key="a"><p key="b" /></div>

// Diff 结果：
// - key="b" 匹配，但 type div → p，删除旧 div，创建新 p
// - key="c" 的 span 被删除（deleteRemainingChildren 删除多余兄弟）
```

---

## 多节点 Diff

当新的 children 是数组时，调用 `reconcileChildrenArray`（**最复杂的部分**）。

### 算法设计思路

React Diff 不用双指针（头尾同时遍历），而是**两轮遍历**：
- 第一轮：处理变更（从左到右，遇到 key 不同就停止）
- 第二轮：处理剩余（新增、移动）

之所以这样设计，是因为实际场景中**更新远多于移动**，从左到右顺序更新效率最高。

### 第一轮遍历：处理可以原地更新的节点

```js
function reconcileChildrenArray(returnFiber, currentFirstChild, newChildren, lanes) {
  let resultingFirstChild: Fiber | null = null;  // 新链表的头节点
  let previousNewFiber: Fiber | null = null;     // 新链表的当前尾节点

  let oldFiber = currentFirstChild;   // 当前处理的旧节点
  let lastPlacedIndex = 0;            // 最后一个"原地复用"节点的旧索引（关键！）
  let newIdx = 0;                     // 新数组的当前索引
  let nextOldFiber = null;            // 下一个待处理的旧节点

  // ─── 第一轮：从左到右，处理 key/type 都相同的节点 ───
  for (; oldFiber !== null && newIdx < newChildren.length; newIdx++) {
    if (oldFiber.index > newIdx) {
      // 旧节点 index 更大，说明新节点这个位置在旧数组中不存在
      nextOldFiber = oldFiber;
      oldFiber = null;
    } else {
      nextOldFiber = oldFiber.sibling;
    }

    // updateSlot：key 相同则复用，key 不同则返回 null
    const newFiber = updateSlot(returnFiber, oldFiber, newChildren[newIdx], lanes);

    if (newFiber === null) {
      // key 不同，第一轮结束
      if (oldFiber === null) oldFiber = nextOldFiber;
      break;
    }

    // 记录需要删除的旧节点
    if (oldFiber && newFiber.alternate === null) {
      deleteChild(returnFiber, oldFiber);
    }

    // 判断是否需要移动（lastPlacedIndex 算法，见下文）
    lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);

    // 构建新链表
    if (previousNewFiber === null) {
      resultingFirstChild = newFiber;
    } else {
      previousNewFiber.sibling = newFiber;
    }
    previousNewFiber = newFiber;
    oldFiber = nextOldFiber;
  }
```

### 第一轮结束后的三种情况

```js
  // ─── 情况 1：新节点遍历完，旧节点还有剩余 → 删除多余的旧节点 ───
  if (newIdx === newChildren.length) {
    deleteRemainingChildren(returnFiber, oldFiber);
    return resultingFirstChild;
  }

  // ─── 情况 2：旧节点遍历完，新节点还有剩余 → 全部新增 ───
  if (oldFiber === null) {
    for (; newIdx < newChildren.length; newIdx++) {
      const newFiber = createChild(returnFiber, newChildren[newIdx], lanes);
      if (newFiber === null) continue;
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      // 追加到新链表...
    }
    return resultingFirstChild;
  }

  // ─── 情况 3：新旧节点都有剩余（存在移动）→ 用 Map 加速查找 ───
  const existingChildren = mapRemainingChildren(oldFiber);
  // existingChildren: Map<key | index, Fiber>

  for (; newIdx < newChildren.length; newIdx++) {
    const newFiber = updateFromMap(existingChildren, returnFiber, newIdx, newChildren[newIdx], lanes);
    if (newFiber !== null) {
      if (newFiber.alternate !== null) {
        // 复用了旧节点，从 Map 中移除
        existingChildren.delete(newFiber.key === null ? newIdx : newFiber.key);
      }
      lastPlacedIndex = placeChild(newFiber, lastPlacedIndex, newIdx);
      // 追加到新链表...
    }
  }

  // Map 中剩余的旧节点 → 全部标记删除
  existingChildren.forEach(child => deleteChild(returnFiber, child));

  return resultingFirstChild;
}
```

### `lastPlacedIndex` 算法：判断节点是否需要移动

```js
function placeChild(newFiber, lastPlacedIndex, newIndex) {
  newFiber.index = newIndex;

  if (!shouldTrackSideEffects) {
    // 首次挂载，不需要标记 Placement
    newFiber.flags |= Forked;
    return lastPlacedIndex;
  }

  const current = newFiber.alternate;
  if (current !== null) {
    // 这是一个复用的旧节点
    const oldIndex = current.index;  // 旧节点在旧数组中的位置

    if (oldIndex < lastPlacedIndex) {
      // 旧位置在"上次稳定节点"之前 → 需要向右移动
      newFiber.flags |= Placement;  // 标记需要插入（移动）
      return lastPlacedIndex;       // lastPlacedIndex 不变
    } else {
      // 旧位置在"上次稳定节点"之后 → 不需要移动，原地复用
      return oldIndex;  // 更新 lastPlacedIndex
    }
  } else {
    // 全新的节点 → 需要插入
    newFiber.flags |= Placement;
    return lastPlacedIndex;
  }
}
```

### lastPlacedIndex 算法图解

**示例 1：尾部新增**

```
旧：A B C
新：A B C D

第一轮：A(0) B(1) C(2) 全部匹配复用，lastPlacedIndex=2
情况2：D 是新节点，直接创建并 Placement

DOM 操作：insertBefore(D, null) → 1次插入
```

**示例 2：头部插入**

```
旧：A B C
新：D A B C

第一轮：D 与 A key 不同，第一轮立即结束，lastPlacedIndex=0
情况3：
  Map = {A:0, B:1, C:2}
  
  D(newIdx=0): Map 中无 D → 创建，Placement，lastPlacedIndex=0
  A(newIdx=1): Map 中有 A，oldIndex=0
    0 < lastPlacedIndex(0)? 否 → 原地复用，lastPlacedIndex=0
  B(newIdx=2): oldIndex=1
    1 < 0? 否 → 原地复用，lastPlacedIndex=1
  C(newIdx=3): oldIndex=2
    2 < 1? 否 → 原地复用，lastPlacedIndex=2

DOM 操作：创建 D，insertBefore(D, A) → 1次插入，3次不移动
```

**示例 3：尾首移动（React 的"弱点"）**

```
旧：A B C D
新：D A B C

第一轮：D 与 A key 不同，立即结束，lastPlacedIndex=0
情况3：
  Map = {A:0, B:1, C:2, D:3}

  D(newIdx=0): Map 中有 D，oldIndex=3
    3 < 0? 否 → 原地复用，lastPlacedIndex=3  ← D 被认为"不动"
  A(newIdx=1): oldIndex=0
    0 < 3? 是 → 需要移动！Placement，lastPlacedIndex=3
  B(newIdx=2): oldIndex=1
    1 < 3? 是 → 需要移动！Placement，lastPlacedIndex=3
  C(newIdx=3): oldIndex=2
    2 < 3? 是 → 需要移动！Placement，lastPlacedIndex=3

DOM 操作：
  A → insertBefore(A, null)   // 移到末尾... 实际是移动
  B → insertBefore(B, null)
  C → insertBefore(C, null)
→ 3次移动！（Vue 用 LIS 只需 0 次移动，因为 ABC 本身有序）
```

---

## 与 Vue 3 Diff 算法对比

| 维度 | React | Vue 3 |
|------|-------|-------|
| 算法 | `lastPlacedIndex`（贪心）| 最长递增子序列（LIS，最优）|
| 时间复杂度 | O(n) | O(n log n)（LIS 部分）|
| 尾→首移动 | 3次 DOM 操作 | 0次 DOM 操作 |
| 实现复杂度 | 简单 | 较复杂 |
| 设计哲学 | "够用就好"，优化常见场景 | 追求最小 DOM 操作 |

**Vue 3 的 LIS 思路**（对比参考）：

```
旧：A B C D        新：D A B C
旧序列索引：A=0, B=1, C=2, D=3

对新序列在旧序列中找对应的索引：D→3, A→0, B→1, C→2
找最长递增子序列：[0,1,2]（即 A B C 不需要移动）
只移动不在 LIS 中的节点：D（1次）

DOM 操作：只需移动 D → 1次
```

---

## 关键要点

1. **三个假设**：不同 type 直接销毁重建、同层对比、key 唯一标识，将复杂度降到 O(n)
2. **两轮遍历**：第一轮顺序处理相同 key 的节点，第二轮用 Map 处理乱序
3. **`lastPlacedIndex`**：相对顺序不变就不移动，这是 React 的贪心策略
4. **key 的重要性**：没有 key 用 index 作为标识，列表增删时会有问题
5. **React vs Vue3**：React 算法更简单但不最优，Vue3 追求最小 DOM 操作

---

## key 的正确使用

```jsx
// ❌ 用 index 做 key（删除中间元素时会错误复用）
{items.map((item, index) => <Item key={index} data={item} />)}

// ✅ 用稳定且唯一的 ID 做 key
{items.map(item => <Item key={item.id} data={item} />)}

// ❌ 用 Math.random() 做 key（每次渲染都不同，永远无法复用）
{items.map(item => <Item key={Math.random()} data={item} />)}

// ✅ 利用 key 强制重置组件状态
<Profile key={userId} userId={userId} />
// userId 变化 → key 变化 → 销毁旧组件，创建新组件，state 重置
```

---

## 下一章

→ [05. Commit 阶段](./05-commit.md) — 了解 React 如何将 Fiber 树的变化应用到真实 DOM
