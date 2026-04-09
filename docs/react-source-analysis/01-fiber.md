# 01. Fiber 架构与双缓冲

> 源码文件：`packages/react-reconciler/src/ReactFiber.js`

## 概述

**学习目标**：
- 理解 Fiber 节点的数据结构及每个字段的作用
- 理解双缓冲（Double Buffering）机制为何能实现可中断渲染
- 掌握 Fiber 树的链表遍历方式

React 16 之前用递归遍历 VDOM，无法中断，长任务会卡顿。Fiber 架构将渲染拆解为一个个**工作单元**（FiberNode），每个工作单元处理完可以**让出主线程**，让浏览器响应用户输入，然后再继续。

---

## FiberNode 数据结构

**源码位置**：`packages/react-reconciler/src/ReactFiber.js` L138

```js
function FiberNode(tag, pendingProps, key, mode) {
  // ── 身份信息 ──────────────────────────────────────────
  this.tag = tag;           // 节点类型枚举（见下表）
  this.key = key;           // React key，Diff 时用于复用判断
  this.elementType = null;  // JSX 元素类型（包含 forwardRef 包装）
  this.type = null;         // 真正的组件函数/类/字符串（如 "div"）
  this.stateNode = null;    // 对应的真实 DOM 节点 或 类组件实例

  // ── 链表树结构（Fiber 树不是普通树，是链表！）──────────
  this.return = null;       // 父 Fiber（注意：不叫 parent）
  this.child = null;        // 第一个子 Fiber
  this.sibling = null;      // 下一个兄弟 Fiber
  this.index = 0;           // 在父节点 children 中的索引

  // ── 双缓冲核心 ─────────────────────────────────────────
  this.alternate = null;    // current ↔ workInProgress 互相指向

  // ── 状态与属性 ─────────────────────────────────────────
  this.pendingProps = pendingProps; // 本次渲染传入的新 props
  this.memoizedProps = null;        // 上次渲染完成后的 props
  this.memoizedState = null;        // 函数组件：Hooks 链表头；类组件：state 对象
  this.updateQueue = null;          // 类组件的 setState 队列；HostRoot 的初始 element

  // ── 副作用标记（位掩码）─────────────────────────────────
  this.flags = NoFlags;             // 当前节点需要执行的副作用
  this.subtreeFlags = NoFlags;      // 子树中所有副作用的汇总（completeWork 阶段冒泡）
  this.deletions = null;            // 需要删除的子 Fiber 列表

  // ── 优先级 ─────────────────────────────────────────────
  this.lanes = NoLanes;             // 当前节点待处理的优先级集合
  this.childLanes = NoLanes;        // 子树中待处理的优先级集合
}
```

### tag 类型枚举（常用）

| tag 值 | 常量名 | 对应场景 |
|--------|--------|----------|
| 0 | `FunctionComponent` | 函数组件 |
| 1 | `ClassComponent` | 类组件 |
| 3 | `HostRoot` | 根节点（`createRoot` 创建） |
| 5 | `HostComponent` | DOM 元素（`"div"`、`"span"` 等） |
| 6 | `HostText` | 文本节点 |
| 10 | `ContextProvider` | `<Context.Provider>` |
| 13 | `SuspenseComponent` | `<Suspense>` |

### flags 副作用位掩码（常用）

```js
export const Placement    = 0b000000000000000000000000010; // 新增节点
export const Update       = 0b000000000000000000000000100; // 更新节点
export const Deletion     = 0b000000000000000000000001000; // 删除节点
export const Ref          = 0b000000000000000001000000000; // ref 操作
export const Passive      = 0b000000000000100000000000000; // useEffect
export const LayoutMask   = 0b000000000000000100010100100; // useLayoutEffect
```

---

## 树形链表结构

Fiber 树不是普通的树，而是**链表**。给定以下组件树：

```jsx
// 组件结构
<App>
  <Header />
  <Main>
    <Sidebar />
    <Content />
  </Main>
</App>
```

对应的 Fiber 链表结构：

```
FiberRoot
  └── HostRoot (current)
        └── App (child)
              ├── Header (child)      ─── Main (sibling)
              │   return↑                 ├── Sidebar (child) ─── Content (sibling)
              │                           │   return↑              return↑
              │                           └── (child: null)
              └── return: App
```

遍历规则（深度优先）：
1. 有 `child` → 向下走（`beginWork`）
2. 无 `child` → 完成当前节点（`completeWork`）
3. 有 `sibling` → 走向兄弟
4. 无 `sibling` → 回到 `return`（父节点）继续完成

---

## 双缓冲机制

> 类比：电影胶片的双底片技术。一张底片（current tree）正在放映，另一张（workInProgress tree）在后台剪辑，剪辑完成后切换放映底片。

```
FiberRoot
  └── current ──────────────────────────────────────────┐
                                                         │
  current tree（屏幕显示）    workInProgress tree（后台构建）
  ┌──────────┐               ┌──────────────┐
  │  App     │←── alternate──│  App'        │
  │  Header  │←── alternate──│  Header'     │
  │  Main    │←── alternate──│  Main'       │
  └──────────┘               └──────────────┘
                                     │
              更新完成后 FiberRoot.current 切换指向 ──────┘
```

### 源码实现

**`createWorkInProgress`**（L327）：

```js
export function createWorkInProgress(current: Fiber, pendingProps: any): Fiber {
  let workInProgress = current.alternate;

  if (workInProgress === null) {
    // 首次创建：没有对应的 alternate，新建一个
    workInProgress = createFiber(current.tag, pendingProps, current.key, current.mode);
    workInProgress.elementType = current.elementType;
    workInProgress.type = current.type;
    workInProgress.stateNode = current.stateNode;  // 复用 DOM 节点

    // 建立双向指针
    workInProgress.alternate = current;
    current.alternate = workInProgress;
  } else {
    // 复用已有的 alternate（避免重复内存分配，对象池思想）
    workInProgress.pendingProps = pendingProps;
    workInProgress.type = current.type;
    // 清除上次的副作用标记（重新计算）
    workInProgress.flags = NoFlags;
    workInProgress.subtreeFlags = NoFlags;
    workInProgress.deletions = null;
  }

  // 复制大部分字段（从 current 同步到 workInProgress）
  workInProgress.flags = current.flags & StaticMask;
  workInProgress.childLanes = current.childLanes;
  workInProgress.lanes = current.lanes;
  workInProgress.child = current.child;
  workInProgress.memoizedProps = current.memoizedProps;
  workInProgress.memoizedState = current.memoizedState;
  workInProgress.updateQueue = current.updateQueue;

  return workInProgress;
}
```

### 切换时机

`commitRoot` 阶段末尾：

```js
// packages/react-reconciler/src/ReactFiberWorkLoop.js
root.current = finishedWork;  // workInProgress tree 变成新的 current tree
```

**好处**：
- 渲染中途发生错误 → 丢弃 workInProgress tree，current tree 仍然有效，页面不会白屏
- 可以在后台（workInProgress）构建新树，不影响当前显示

---

## 渲染阶段树遍历

**`performUnitOfWork`**（`ReactFiberWorkLoop.js` L3054）：

```js
function performUnitOfWork(unitOfWork: Fiber): void {
  const current = unitOfWork.alternate;  // 取对应的 current fiber

  let next;
  // beginWork：处理当前节点，返回子节点（或 null）
  next = beginWork(current, unitOfWork, entangledRenderLanes);

  // 更新 memoizedProps（本次渲染完成）
  unitOfWork.memoizedProps = unitOfWork.pendingProps;

  if (next === null) {
    // 没有子节点，完成当前节点（向上）
    completeUnitOfWork(unitOfWork);
  } else {
    // 继续处理子节点
    workInProgress = next;
  }
}
```

遍历顺序示意（以上面的组件树为例）：

```
beginWork(App)          → 返回 Header（第一个子节点）
  beginWork(Header)     → 返回 null（无子节点）
  completeWork(Header)  → 完成，转到兄弟节点 Main
  beginWork(Main)       → 返回 Sidebar
    beginWork(Sidebar)  → 返回 null
    completeWork(Sidebar) → 完成，转到兄弟节点 Content
    beginWork(Content)  → 返回 null
    completeWork(Content) → 完成，无兄弟，回到父节点 Main
  completeWork(Main)    → 完成，转到兄弟节点（无），回到 App
completeWork(App)       → 完成，整棵树处理完毕
```

---

## 关键要点

1. **Fiber = 工作单元**：每个 FiberNode 对应一次 `beginWork` + `completeWork`，处理完可以暂停
2. **链表 ≠ 树**：用 `child`/`sibling`/`return` 三个指针模拟树结构，支持迭代（而非递归）遍历
3. **双缓冲**：`alternate` 指针连接 current 和 workInProgress，复用节点避免 GC 压力
4. **`subtreeFlags` 冒泡**：`completeWork` 阶段将子树副作用向上聚合，commit 时跳过无副作用子树

---

## 下一章

→ [02. Scheduler & Lane 模型](./02-scheduler-lane.md) — 了解 React 如何决定哪个更新先执行
