# 06. Concurrent Mode（并发模式）

> 源码文件：
> - `packages/react-reconciler/src/ReactFiberWorkLoop.js`
> - `packages/react-reconciler/src/ReactFiberHooks.js`（useTransition / useDeferredValue）

## 概述

**学习目标**：
- 理解 Concurrent Mode 为何能让 React 感觉"更快"（实际上是更响应）
- 掌握优先级抢占（Priority Interruption）的完整机制
- 理解 `useTransition` 和 `useDeferredValue` 的内部实现
- 弄清楚 `startTransition` 与普通 `setState` 的本质区别

---

## 核心思想

Concurrent Mode 的核心不是"渲染更快"，而是**让高优先级任务能够随时插队**。

```
传统同步渲染（Legacy Mode）：
│ 渲染10000个节点（100ms）          │ 用户输入响应 │
└───────────────────────────────────┘              ←卡顿100ms才响应

并发渲染（Concurrent Mode）：
│ 渲染 5ms │← 高优先级插队！│ 用户输入响应 │ 继续渲染 95ms │
└──────────┘                └──────────────┘               ←立即响应
```

---

## 两种工作循环

**源码位置**：`packages/react-reconciler/src/ReactFiberWorkLoop.js`

```js
// 同步循环（L2745）：紧急更新，不可中断，一口气跑完
function workLoopSync() {
  while (workInProgress !== null) {
    performUnitOfWork(workInProgress);
  }
}

// 并发循环（L3046）：由 Scheduler 控制，每5ms让出主线程一次
function workLoopConcurrentByScheduler() {
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
    //                                ↑ shouldYield() = performance.now() >= deadline
    //                                  每5ms检查一次，超时则退出循环
  }
  // 退出后：
  // - 若 workInProgress !== null → 任务未完成，返回 true 让 Scheduler 安排下次执行
  // - 若 workInProgress === null → 任务完成，进入 Commit 阶段
}
```

**哪些更新走同步循环，哪些走并发循环？**

```js
// ensureRootIsScheduled（ReactFiberRootScheduler.js）
function scheduleTaskForRootDuringMicrotask(root, currentTime) {
  const nextLanes = getNextLanes(root, ...);

  if (includesSyncLane(nextLanes)) {
    // SyncLane / InputContinuousLane → 同步执行
    scheduleSyncCallback(performSyncWorkOnRoot.bind(null, root));
  } else {
    // 其他 Lane（DefaultLane、TransitionLane 等）→ 并发执行
    const priority = lanesToEventPriority(nextLanes);
    scheduleCallback(priority, performConcurrentWorkOnRoot.bind(null, root));
  }
}
```

---

## 优先级抢占流程

假设用户正在进行 `useTransition` 搜索，同时点击了一个按钮：

```
1. 正在进行 TransitionLane 的并发渲染（workLoopConcurrentByScheduler 中）

2. 用户点击按钮 → 触发 SyncLane 更新
   dispatchSetState(..., SyncLane)
   scheduleUpdateOnFiber(root, fiber, SyncLane)
   ensureRootIsScheduled(root)     ← 发现有更高优先级的 Lane

3. Scheduler 的 shouldYield() 因高优先级任务返回 true
   → workLoopConcurrentByScheduler 退出
   → performConcurrentWorkOnRoot 返回给 Scheduler

4. performConcurrentWorkOnRoot 检查是否需要重启：
```

```js
function performConcurrentWorkOnRoot(root, didTimeout) {
  // ...执行工作循环...
  const exitStatus = renderRootConcurrent(root, lanes);

  if (exitStatus === RootInProgress) {
    // 工作未完成，被中断了
    // 检查是否因为有更高优先级更新
    if (workInProgressRootDidAttachPingListener) {
      // 直接丢弃当前进度，重新开始（保证一致性）
      prepareFreshStack(root, NoLanes);
    }
    return performConcurrentWorkOnRoot.bind(null, root);  // 返回自身，告诉 Scheduler 还有工作
  }

  if (exitStatus === RootCompleted) {
    const finishedWork = root.current.alternate;
    root.finishedWork = finishedWork;
    root.finishedLanes = lanes;
    commitRoot(root, ...);
  }
}
```

5. Scheduler 将高优先级任务（`performSyncWorkOnRoot`）插队执行：

```js
// workLoop（Scheduler.js）
while (currentTask !== null) {
  if (currentTask.expirationTime > currentTime && shouldYieldToHost()) {
    break;  // 让出
  }
  // 执行任务...
  // 高优先级任务（ImmediatePriority）的 expirationTime 已过期（-1 + startTime）
  // 所以不会因 shouldYieldToHost 跳过，立即执行
}
```

**完整抢占时序：**

```
TransitionLane 渲染（后台）
  │─────────5ms──────│
  └── shouldYield()=true（时间片用完）
         │
  ╔══════╧══════════════════════════════════╗
  ║  高优先级：SyncLane 插队                 ║
  ║  performSyncWorkOnRoot() → commitRoot() ║
  ║  用户看到点击响应（< 5ms 延迟）          ║
  ╚══════════════════════════════════════╤══╝
                                         │
  重新调度 TransitionLane ←──────────────┘
  （从头开始 or 复用已完成的部分）
  │─────────────────────────────│
  commitRoot()（搜索结果更新）
```

---

## startTransition 实现原理

### 源码实现

**`useTransition`** 在 `ReactFiberHooks.js`：

```js
function mountTransition(): [boolean, (callback: () => void, options?: StartTransitionOptions) => void] {
  const [, setPending] = mountState(false);  // isPending 状态
  const start = startTransition.bind(null, setPending);
  const hook = mountWorkInProgressHook();
  hook.memoizedState = start;
  return [false, start];
}

function startTransition(setPending, callback, options) {
  // 1. 同步设置 isPending = true（SyncLane，立即显示加载状态）
  const prevTransition = ReactSharedInternals.T;
  const currentTransition = {};
  ReactSharedInternals.T = currentTransition;  // 进入 Transition 上下文

  setPending(true);  // 触发同步更新：SyncLane

  try {
    // 2. 执行用户的回调（在 Transition 上下文中触发的更新会被分配 TransitionLane）
    callback();
  } finally {
    ReactSharedInternals.T = prevTransition;  // 退出 Transition 上下文

    // 3. 设置 isPending = false（TransitionLane，和 callback 的更新一起提交）
    setPending(false);
  }
}
```

### requestUpdateLane 如何分配 Transition Lane

```js
function requestUpdateLane(fiber: Fiber): Lane {
  const mode = fiber.mode;

  // 1. 检查是否在 Transition 上下文中
  const transition = ReactSharedInternals.T;
  if (transition !== null) {
    // 在 startTransition(() => { setState(...) }) 内部
    // 分配一个 TransitionLane
    if (!transition._updatedFibers) {
      transition._updatedFibers = new Set();
    }
    transition._updatedFibers.add(fiber);

    const transitionLane = claimNextTransitionLane();
    // claimNextTransitionLane 循环分配 16 个 TransitionLane 之一，防止饥饿
    return transitionLane;
  }

  // 2. 检查当前事件类型（来自 React 合成事件系统）
  const updateLane: Lane = (getCurrentUpdatePriority(): any);
  if (updateLane !== NoLane) {
    return updateLane;  // 用户点击 → SyncLane
  }

  // 3. 根据 Scheduler 当前优先级推断
  const eventLane: Lane = (getCurrentEventPriority(): any);
  return eventLane;
}
```

### 实例：搜索框 + useTransition

```jsx
function SearchPage() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isPending, startTransition] = useTransition();

  function handleChange(e) {
    // 1. query 更新：SyncLane（立即响应，输入框不卡）
    setQuery(e.target.value);

    // 2. results 更新：TransitionLane（后台渲染，不阻塞输入）
    startTransition(() => {
      setResults(searchData(e.target.value));  // 可能渲染 10000 条结果
    });
  }

  return (
    <>
      <input value={query} onChange={handleChange} />
      {isPending && <Spinner />}  {/* SyncLane 立即显示 */}
      <ResultList data={results} />  {/* TransitionLane 后台更新 */}
    </>
  );
}
```

**渲染时序**：

```
用户输入 "r"
  ├── setQuery("r")   → SyncLane → 立即渲染 → input 显示 "r"，isPending=true 显示 Spinner
  └── setResults(...) → TransitionLane → 后台渲染 10000 条结果
         │
         用户继续输入 "re"（在渲染 10000 条结果途中）
         │
         ├── setQuery("re")  → SyncLane → 抢占！中断 10000 条渲染
         │                               → input 显示 "re"
         └── setResults(...) → 新 TransitionLane → 重新开始后台渲染
               （丢弃 "r" 的未完成渲染，不会看到中间状态）
```

---

## useDeferredValue 实现原理

`useDeferredValue` 类似于 `useTransition`，但用于"接收值"而不是"触发动作"：

```js
function updateDeferredValueImpl<T>(hook, prevValue, value, debugStack) {
  if (is(value, prevValue)) {
    // 值没变，直接返回旧值
    return value;
  }

  if (isCurrentTreeHidden) {
    // Offscreen 中的渲染，总是使用最新值
    hook.memoizedState = value;
    return value;
  }

  if (!includesSomeLane(renderLanes, TransitionLanes)) {
    // 当前不是 Transition 渲染，安排一次 Deferred 更新
    didScheduleUpdateDuringRender = true;
    return prevValue;  // 本次渲染先返回旧值（撑住当前画面）
  }

  // 是 Transition 渲染，使用新值
  hook.memoizedState = value;
  return value;
}
```

**行为对比**：

```jsx
// useTransition：你控制"哪些 setState 是低优先级的"
const [isPending, startTransition] = useTransition();
startTransition(() => setItems(newItems));

// useDeferredValue：你控制"哪个值的消费是低优先级的"
const deferredQuery = useDeferredValue(query);
// 渲染时 deferredQuery 会"滞后"一帧，先用旧值撑住画面，异步更新新值

// 效果等价于：
const [deferredQuery, setDeferredQuery] = useState(query);
useEffect(() => {
  startTransition(() => setDeferredQuery(query));
}, [query]);
```

---

## Concurrent Mode 中的 Suspense

```jsx
function App() {
  return (
    <Suspense fallback={<Spinner />}>
      <DataComponent />  {/* 可能 throw Promise */}
    </Suspense>
  );
}
```

**Throw Promise 处理流程**：

```js
// beginWork 中，DataComponent 抛出 Promise
// workLoopConcurrentByScheduler 捕获异常

function renderRootConcurrent(root, lanes) {
  try {
    workLoopConcurrent();
  } catch (thrownValue) {
    if (thrownValue instanceof Promise) {
      // 1. 向上找最近的 Suspense 边界
      const suspenseBoundary = getNearestSuspenseBoundary(workInProgress);

      // 2. 标记 Suspense 为 DidCapture（展示 fallback）
      suspenseBoundary.flags |= DidCapture;

      // 3. 给 Promise 注册回调，resolve 后重新触发渲染
      thrownValue.then(() => {
        // 重新调度，这次 data 已经可用
        scheduleUpdateOnFiber(root, suspenseBoundary, RetryLane);
      });

      // 4. 回退到 Suspense 节点，重新 beginWork（渲染 fallback）
      workInProgress = suspenseBoundary;
      continue;
    }
  }
}
```

**与 useTransition 结合**：

```jsx
// startTransition 内的 Suspense 不会立即显示 fallback
// 而是保持旧画面，直到新数据加载完成（更好的 UX）
startTransition(() => {
  setPage('/new-page');  // 如果 /new-page 触发 Suspense
});
// isPending=true → 显示 isPending 状态（而不是 fallback）
// 新页面加载完成 → 直接切换，没有 "加载中" 的闪烁
```

---

## 对比：Legacy Mode vs Concurrent Mode

| 特性 | Legacy Mode（`render`）| Concurrent Mode（`createRoot`）|
|------|------------------------|-------------------------------|
| 渲染模式 | 同步，不可中断 | 并发，可中断 |
| 优先级抢占 | ❌ | ✅ |
| useTransition | ❌ | ✅ |
| useDeferredValue | ❌（降级为同步）| ✅ |
| Suspense 行为 | 立即显示 fallback | 保持旧内容，直到新内容准备好 |
| Automatic Batching | 仅事件处理器内 | 所有地方（包括 setTimeout、Promise）|
| 时间切片 | ❌ | ✅（5ms 时间片）|
| StrictMode 行为 | 双调用检查（仅开发）| 同上 + 检测可中断渲染一致性 |

---

## Automatic Batching（自动批处理）

React 18 在 Concurrent Mode 中将批处理扩展到所有地方：

```jsx
// React 17（Legacy Mode）：
setTimeout(() => {
  setCount(c => c + 1);  // → 1次重渲染
  setName('React');      // → 1次重渲染
  // 共 2 次重渲染！
}, 1000);

// React 18（Concurrent Mode）：
setTimeout(() => {
  setCount(c => c + 1);  // → 批处理
  setName('React');      // → 批处理
  // 共 1 次重渲染！
}, 1000);
```

**实现**：在 `scheduleUpdateOnFiber` 中，所有同步触发的 `setState` 都先标记 Lane，
在当前宏任务结束（微任务）时统一调度，合并成一次渲染。

---

## 关键要点

1. **Concurrent Mode = 可中断**：`shouldYield()` 让出主线程，高优先级任务可随时插队
2. **抢占时丢弃**：被中断的 workInProgress 树直接丢弃，重新从 current 开始构建（保证一致性）
3. **startTransition**：切换到 Transition 上下文，使内部 setState 分配 TransitionLane
4. **useDeferredValue**：先渲染旧值（撑住画面），后台异步渲染新值
5. **Suspense + Transition**：结合使用可实现"无闪烁"页面切换

---

← [返回目录](./README.md)
