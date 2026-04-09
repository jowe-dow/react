# 05. Commit 阶段

> 源码文件：`packages/react-reconciler/src/ReactFiberCommitWork.js`

## 概述

**学习目标**：
- 掌握 Commit 阶段三个子阶段的职责与执行顺序
- 理解 `subtreeFlags` 优化如何跳过无副作用子树
- 弄清楚 `useEffect` / `useLayoutEffect` / `componentDidMount` 的执行时序
- 理解为什么 Commit 阶段不可中断

---

## Commit 阶段概览

Render 阶段（可中断）构建完 workInProgress 树后，进入 **Commit 阶段（不可中断）**，
将所有副作用（flags）应用到真实 DOM。

```
commitRoot(root)
  │
  ├── 1. Before Mutation 子阶段（DOM 变更前）
  │      ├─ getSnapshotBeforeUpdate()（类组件）
  │      └─ 调度 useEffect 的清理和回调（异步）
  │
  ├── 2. Mutation 子阶段（DOM 变更）← 主要工作
  │      ├─ Deletion: 删除节点（调用 componentWillUnmount / useLayoutEffect cleanup）
  │      ├─ Placement: 插入新节点
  │      └─ Update: 更新 DOM 属性
  │
  │      ★ root.current = finishedWork（切换双缓冲树）
  │
  └── 3. Layout 子阶段（DOM 变更后，绘制前）
         ├─ componentDidMount / componentDidUpdate（类组件）
         ├─ useLayoutEffect 回调（函数组件）
         └─ ref 更新（attachRef）

（异步，在绘制后执行）
  └── 4. Passive Effects
         ├─ useEffect 上次的清理函数
         └─ useEffect 本次的回调
```

---

## `subtreeFlags` 优化

**问题**：Commit 阶段需要遍历整棵 Fiber 树找副作用，代价很大。

**优化**：在 `completeWork` 阶段将子树的 `flags` 向上**冒泡**到父节点的 `subtreeFlags`。

```js
// completeWork 末尾（ReactFiberCompleteWork.js）
function bubbleProperties(completedWork: Fiber) {
  let subtreeFlags = NoFlags;
  let newChildLanes = NoLanes;
  let child = completedWork.child;

  while (child !== null) {
    // 收集子节点自身的 flags 和其子树的 subtreeFlags
    subtreeFlags |= child.subtreeFlags;
    subtreeFlags |= child.flags;
    newChildLanes = mergeLanes(newChildLanes, mergeLanes(child.lanes, child.childLanes));
    child = child.sibling;
  }

  completedWork.subtreeFlags |= subtreeFlags;
  completedWork.childLanes = newChildLanes;
}
```

**Commit 时的跳过逻辑**：

```js
function commitMutationEffects(root, finishedWork, committedLanes) {
  commitMutationEffectsOnFiber(finishedWork, root, committedLanes);
}

function commitMutationEffectsOnFiber(finishedWork, root, lanes) {
  // 如果子树没有任何副作用，直接跳过整个子树！
  if ((finishedWork.subtreeFlags & MutationMask) !== NoFlags) {
    // 先递归处理子节点
    const child = finishedWork.child;
    while (child !== null) {
      commitMutationEffectsOnFiber(child, root, lanes);
      child = child.sibling;
    }
  }

  // 再处理当前节点自身的副作用
  const flags = finishedWork.flags;
  switch (finishedWork.tag) {
    case FunctionComponent:
    case ForwardRef:
    case MemoComponent: {
      // useLayoutEffect 的清理函数
      commitHookEffectListUnmount(HookLayout | HookHasEffect, finishedWork, finishedWork.return);
      // 处理 DOM 变更（Placement/Update）
      commitReconciliationEffects(finishedWork);
      break;
    }
    case HostComponent: {
      commitReconciliationEffects(finishedWork);
      if (flags & Update) {
        const instance = finishedWork.stateNode;
        if (instance != null) {
          const newProps = finishedWork.memoizedProps;
          const oldProps = current !== null ? current.memoizedProps : newProps;
          const type = finishedWork.type;
          // 更新 DOM 属性（className、style、事件等）
          updateProperties(instance, type, oldProps, newProps);
        }
      }
      break;
    }
    // ...
  }
}
```

---

## 子阶段详解

### 1. Before Mutation（突变前）

**`commitBeforeMutationEffects`**：

```js
function commitBeforeMutationEffectsOnFiber(finishedWork: Fiber) {
  const current = finishedWork.alternate;
  const flags = finishedWork.flags;

  if (flags & Snapshot) {
    // 类组件：调用 getSnapshotBeforeUpdate（DOM 变更前最后一次读取 DOM）
    if (finishedWork.tag === ClassComponent) {
      const prevProps = current.memoizedProps;
      const prevState = current.memoizedState;
      const instance = finishedWork.stateNode;
      const snapshot = instance.getSnapshotBeforeUpdate(
        finishedWork.elementType === finishedWork.type
          ? prevProps
          : resolveDefaultPropsOnNonClassComponent(finishedWork.type, prevProps),
        prevState,
      );
      instance.__reactInternalSnapshotBeforeUpdate = snapshot;
    }
  }
}

// 同时安排 useEffect 的异步执行（注意：这里只是"安排"，不立即执行）
function schedulePassiveEffects(finishedWork: Fiber) {
  const updateQueue: FunctionComponentUpdateQueue | null = finishedWork.updateQueue;
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;
    do {
      const { next, tag } = effect;
      if ((tag & HookPassive) !== NoHookEffect && (tag & HookHasEffect) !== NoHookEffect) {
        // 将 useEffect 的 fiber 推入队列，稍后异步执行
        enqueuePendingPassiveHookEffectUnmount(finishedWork, effect);
        enqueuePendingPassiveHookEffectMount(finishedWork, effect);
      }
      effect = next;
    } while (effect !== firstEffect);
  }
}
```

### 2. Mutation（DOM 突变）

这是最核心的阶段。

**`commitReconciliationEffects`** — 处理 Placement（新增/移动）：

```js
function commitReconciliationEffects(finishedWork: Fiber) {
  const flags = finishedWork.flags;

  if (flags & Placement) {
    commitPlacement(finishedWork);
    // 清除 Placement 标记
    finishedWork.flags &= ~Placement;
  }
}

function commitPlacement(finishedWork: Fiber): void {
  // 1. 找到最近的 Host 祖先（HostComponent 或 HostRoot）
  const parentFiber = getHostParentFiber(finishedWork);
  const parentDom = parentFiber.tag === HostComponent
    ? parentFiber.stateNode
    : parentFiber.stateNode.containerInfo;  // HostRoot

  // 2. 找到参照节点（锚点）
  const before = getHostSibling(finishedWork);

  // 3. 插入 DOM
  if (before) {
    parentDom.insertBefore(getHostNode(finishedWork), before);
  } else {
    parentDom.appendChild(getHostNode(finishedWork));
  }
}
```

**更新 DOM 属性**（`updateProperties`）：

```js
// react-dom-bindings/src/client/ReactDOMComponent.js
function updateProperties(domElement, type, oldProps, newProps) {
  // 处理特殊属性
  if (type === 'input') {
    updateInput(domElement, ...);
  }

  // 遍历旧 props，删除不再存在的属性
  for (propKey in oldProps) {
    if (!newProps.hasOwnProperty(propKey)) {
      switch (propKey) {
        case 'style':
          oldStyle = oldProps.style;
          for (styleName in oldStyle) {
            domElement.style[styleName] = '';
          }
          break;
        case 'className':
          domElement.removeAttribute('class');
          break;
        // 事件不在这里处理（React 用事件委托到 root）
      }
    }
  }

  // 遍历新 props，设置新/变更的属性
  for (propKey in newProps) {
    const nextProp = newProps[propKey];
    const lastProp = oldProps[propKey];
    if (nextProp !== lastProp) {
      switch (propKey) {
        case 'style':
          // 只更新变化的样式属性
          for (styleName in nextProp) {
            if (!lastProp || lastProp[styleName] !== nextProp[styleName]) {
              domElement.style[styleName] = nextProp[styleName];
            }
          }
          break;
        case 'className':
          domElement.setAttribute('class', nextProp);
          break;
        case 'children':
          if (typeof nextProp === 'string' || typeof nextProp === 'number') {
            domElement.textContent = '' + nextProp;
          }
          break;
        // onClick 等事件属性实际上已在合成事件系统中委托，这里不单独绑定
      }
    }
  }
}
```

**❗ 切换双缓冲树（Mutation 阶段末尾）**：

```js
// ReactFiberWorkLoop.js（commitRoot 内部）
// Mutation 完成后，立即切换 current 指针
root.current = finishedWork;
// 这发生在 Layout 之前，确保 componentDidMount 读取到的已是新 DOM 状态
```

### 3. Layout（布局阶段）

**`commitLayoutEffects`**：

```js
function commitLayoutEffectOnFiber(root, current, finishedWork, committedLanes) {
  const flags = finishedWork.flags;

  if (finishedWork.tag === FunctionComponent || finishedWork.tag === ForwardRef) {
    // 执行 useLayoutEffect 回调
    commitHookEffectListMount(HookLayout | HookHasEffect, finishedWork);
    // 调度 useInsertionEffect（CSS-in-JS 用）
  }

  if (finishedWork.tag === ClassComponent) {
    const instance = finishedWork.stateNode;
    if (current === null) {
      // 首次挂载
      instance.componentDidMount();
    } else {
      // 更新
      const prevProps = finishedWork.elementType === finishedWork.type
        ? current.memoizedProps
        : resolveDefaultPropsOnNonClassComponent(finishedWork.type, current.memoizedProps);
      const prevState = current.memoizedState;
      instance.componentDidUpdate(prevProps, prevState, instance.__reactInternalSnapshotBeforeUpdate);
    }
  }

  if (flags & Ref) {
    // 更新 ref
    commitAttachRef(finishedWork);
  }
}
```

### 4. Passive Effects（异步，useEffect）

在浏览器绘制**之后**，通过 Scheduler 的 `NormalPriority` 任务执行：

```js
function flushPassiveEffects() {
  // 1. 先执行上次的清理函数（unmount effects）
  commitPassiveUnmountEffects(root.current);

  // 2. 再执行本次的回调（mount effects）
  commitPassiveMountEffects(root, root.current, lanes, transitions);
}

function commitHookEffectListUnmount(flags, finishedWork, nearestMountedAncestor) {
  const updateQueue = finishedWork.updateQueue;
  const lastEffect = updateQueue !== null ? updateQueue.lastEffect : null;
  if (lastEffect !== null) {
    const firstEffect = lastEffect.next;
    let effect = firstEffect;
    do {
      if ((effect.tag & flags) === flags) {
        const inst = effect.inst;
        const destroy = inst.destroy;
        if (destroy !== undefined) {
          inst.destroy = undefined;
          // 执行清理函数（return 的函数）
          safelyCallDestroy(finishedWork, nearestMountedAncestor, destroy);
        }
      }
      effect = effect.next;
    } while (effect !== firstEffect);
  }
}

function commitHookEffectListMount(flags, finishedWork) {
  // 执行 useEffect / useLayoutEffect 回调，保存返回的清理函数
  const effect = ...;
  const create = effect.create;
  const inst = effect.inst;
  const destroy = create();  // 执行用户的 effect 函数
  inst.destroy = destroy;    // 保存清理函数，下次执行前调用
}
```

---

## 完整执行时序

```
commitRoot() 开始（同步，不可中断）
│
├── Before Mutation
│      └── getSnapshotBeforeUpdate（类组件）
│
├── Mutation
│      ├── 删除节点
│      │      ├── componentWillUnmount（类组件）
│      │      └── useLayoutEffect cleanup（函数组件）
│      ├── 插入新节点（insertBefore / appendChild）
│      └── 更新 DOM 属性
│
│── root.current = finishedWork  ← 切换双缓冲树
│
├── Layout
│      ├── componentDidMount / componentDidUpdate（类组件）
│      ├── useLayoutEffect 回调（函数组件）
│      └── ref 更新
│
commitRoot() 结束
│
│──（浏览器绘制）
│
└── Passive Effects（Scheduler NormalPriority，异步）
       ├── useEffect cleanup（上次的清理）
       └── useEffect callback（本次的回调）
```

---

## 为什么 Commit 阶段不可中断？

Render 阶段可中断（只是在内存中操作 Fiber 对象），而 Commit 阶段操作真实 DOM，有两个强限制：

1. **原子性**：DOM 操作必须一次性完成，否则用户会看到"半完成状态"（闪屏）
2. **一致性**：`useLayoutEffect` 需要在浏览器绘制前同步读取 DOM，若中途暂停则读到错误值

---

## 关键要点

1. **三个子阶段顺序**：Before Mutation → Mutation → Layout，每个子阶段都是深度优先遍历
2. **`subtreeFlags` 优化**：冒泡机制让 Commit 可以跳过无副作用子树，大幅减少遍历量
3. **双缓冲切换时机**：Mutation 结束后、Layout 开始前，确保 `componentDidMount` 读到新 DOM
4. **useEffect 异步**：绘制后通过 Scheduler 执行，不阻塞浏览器渲染
5. **清理顺序**：cleanup 在 mount 之前执行（先清理再安装）

---

## 下一章

→ [06. Concurrent Mode](./06-concurrent.md) — 了解可中断渲染、优先级抢占、useTransition 的完整实现
