# 02. Scheduler & Lane 模型

> 源码文件：
> - `packages/scheduler/src/forks/Scheduler.js`
> - `packages/react-reconciler/src/ReactFiberLane.js`

## 概述

**学习目标**：
- 理解 Lane 位掩码优先级模型的设计思路
- 掌握 Scheduler 最小堆 + 时间切片的调度机制
- 理解 React 如何决定哪个更新先执行

React 有两个独立的优先级系统：
- **Lane**（`react-reconciler`）：描述"这次更新有多紧急"，用位掩码表示
- **Scheduler**（独立包）：描述"这个任务什么时候执行"，用最小堆管理

---

## Lane 优先级模型

### 设计思路

**源码位置**：`packages/react-reconciler/src/ReactFiberLane.js` L43

```js
export const TotalLanes = 31;  // 最多 31 条"车道"（32 位整型，1 位符号位）

// 值越小（越靠右的位），优先级越高
export const SyncLane: Lane              = 0b0000000000000000000000000000010; // 用户输入、同步更新
export const SyncHydrationLane: Lane     = 0b0000000000000000000000000000100;
export const InputContinuousLane: Lane   = 0b0000000000000000000000000001000; // 连续输入（滚动、拖拽）
export const InputContinuousHydrationLane: Lane = 0b0000000000000000000000000010000;
export const DefaultLane: Lane           = 0b0000000000000000000000000100000; // 普通 setState
export const GestureLane: Lane           = 0b0000000000000000000000001000000;
const TransitionLanes: Lanes             = 0b0000000001111111111111100000000; // useTransition（16条）
export const RetryLanes: Lanes           = 0b0000111110000000000000000000000; // Suspense 重试（5条）
export const IdleLane: Lane              = 0b0100000000000000000000000000000; // 空闲时执行
export const OffscreenLane: Lane         = 0b1000000000000000000000000000000; // 不可见内容

// 组合常量：需要同步刷新的 Lanes
export const SyncUpdateLanes = SyncLane | InputContinuousLane | DefaultLane;
```

### 为什么用位掩码而不是数字？

```js
// ❌ 传统数字优先级（只能表示单一优先级）
priority = 1;  // 只能是某一个优先级

// ✅ 位掩码（可同时表示多个优先级的集合）
pendingLanes = SyncLane | DefaultLane;  // 同时有两个待处理的优先级

// O(1) 操作：
// 合并：pendingLanes |= newLane
// 检查包含：(pendingLanes & lane) !== NoLanes
// 取最高优先级（最低位的 1）：highestPriorityLane = lanes & -lanes
// 移除：pendingLanes &= ~lane
```

`TransitionLanes` 有 16 条，是因为 `useTransition` 可以嵌套使用，每次调用分配独立的 Lane，避免相互干扰。

### Lane 到 Scheduler 优先级的映射

```js
// packages/react-reconciler/src/ReactFiberRootScheduler.js
function lanesToEventPriority(lanes: Lanes): EventPriority {
  const lane = getHighestPriorityLane(lanes);
  if (!isHigherEventPriority(DiscreteEventPriority, lane)) {
    return DiscreteEventPriority;   // → ImmediatePriority（用户点击）
  }
  if (!isHigherEventPriority(ContinuousEventPriority, lane)) {
    return ContinuousEventPriority; // → UserBlockingPriority（滚动）
  }
  if (includesSomeLane(lanes, TransitionLanes)) {
    return DefaultEventPriority;    // → NormalPriority（transition）
  }
  return IdleEventPriority;         // → IdlePriority（空闲）
}
```

---

## Scheduler 调度器

### 数据结构

**源码位置**：`packages/scheduler/src/forks/Scheduler.js` L48~80

```js
// Task 节点（最小堆的元素）
type Task = {
  id: number,                    // 单调递增的 ID
  callback: Callback | null,     // 要执行的回调（null 表示已取消）
  priorityLevel: PriorityLevel,  // 5 个优先级级别
  startTime: number,             // 任务可以开始的时间
  expirationTime: number,        // 到期时间（超时后必须执行，防止饿死）
  sortIndex: number,             // 最小堆排序键
};

// 两个最小堆
var taskQueue: Array<Task> = [];   // 当前可执行的任务（sortIndex = expirationTime）
var timerQueue: Array<Task> = [];  // 未来才能执行的延迟任务（sortIndex = startTime）
```

**5 个优先级及超时时间**：

| 优先级 | 常量名 | timeout | 场景 |
|--------|--------|---------|------|
| 1 | `ImmediatePriority` | -1（立即过期）| 同步更新、错误恢复 |
| 2 | `UserBlockingPriority` | 250ms | 用户输入（点击、按键） |
| 3 | `NormalPriority` | 5000ms | 普通 setState |
| 4 | `LowPriority` | 10000ms | 数据预获取 |
| 5 | `IdlePriority` | `MAX_INT`（永不过期）| 不重要的后台任务 |

### 调度流程

**`unstable_scheduleCallback`**（L327）：

```js
function unstable_scheduleCallback(priorityLevel, callback, options) {
  var currentTime = getCurrentTime();  // performance.now()

  // 计算开始时间（支持 delay 选项）
  var startTime = options?.delay
    ? currentTime + options.delay
    : currentTime;

  // 计算过期时间（防止低优先级任务被永远跳过）
  var timeout = timeoutForPriorityLevel(priorityLevel);
  var expirationTime = startTime + timeout;

  var newTask = {
    id: taskIdCounter++,
    callback,
    priorityLevel,
    startTime,
    expirationTime,
    sortIndex: -1,
  };

  if (startTime > currentTime) {
    // 延迟任务：推入 timerQueue（按 startTime 排序）
    newTask.sortIndex = startTime;
    push(timerQueue, newTask);
    // 用 setTimeout 在到期时将任务从 timerQueue 移到 taskQueue
    requestHostTimeout(handleTimeout, startTime - currentTime);
  } else {
    // 立即可执行：推入 taskQueue（按 expirationTime 排序）
    newTask.sortIndex = expirationTime;
    push(taskQueue, newTask);
    // 请求宿主调度执行
    requestHostCallback(flushWork);
  }

  return newTask;
}
```

### 时间切片实现

```js
// 使用 MessageChannel 而非 setTimeout（更低延迟，但不阻塞渲染）
const channel = new MessageChannel();
const port = channel.port2;
channel.port1.onmessage = performWorkUntilDeadline;

function requestHostCallback(callback) {
  scheduledHostCallback = callback;
  if (!isMessageLoopRunning) {
    isMessageLoopRunning = true;
    port.postMessage(null);  // 让出主线程，等待下一个宏任务
  }
}

function performWorkUntilDeadline() {
  if (scheduledHostCallback !== null) {
    const currentTime = getCurrentTime();
    // 每帧分配 5ms（frameYieldMs = 5）
    deadline = currentTime + frameYieldMs;

    const hasMoreWork = scheduledHostCallback(true, currentTime);

    if (!hasMoreWork) {
      isMessageLoopRunning = false;
      scheduledHostCallback = null;
    } else {
      // 还有工作，继续发消息（下一个宏任务）
      port.postMessage(null);
    }
  }
}

// 工作循环中检查是否需要让步
function shouldYield() {
  return getCurrentTime() >= deadline;
  // 超过 5ms → 中断当前渲染，让浏览器处理其他任务
}
```

### 工作循环（flushWork → workLoop）

```js
function workLoop(hasTimeRemaining, initialTime) {
  let currentTime = initialTime;

  // 将到期的延迟任务从 timerQueue 移到 taskQueue
  advanceTimers(currentTime);

  currentTask = peek(taskQueue);  // 取堆顶（最高优先级）

  while (currentTask !== null && !enableSchedulerDebugging) {
    if (currentTask.expirationTime > currentTime && !hasTimeRemaining) {
      // 任务未过期且时间片用完 → 中断
      break;
    }

    const callback = currentTask.callback;
    if (typeof callback === 'function') {
      currentTask.callback = null;

      // 执行任务，传入 didTimeout（是否超时）
      const didUserCallbackTimeout = currentTask.expirationTime <= currentTime;
      const continuationCallback = callback(didUserCallbackTimeout);

      if (typeof continuationCallback === 'function') {
        // 任务返回函数 → 任务未完成，留在队列中等待下次执行
        currentTask.callback = continuationCallback;
      } else {
        // 任务完成，从堆中移除
        if (currentTask === peek(taskQueue)) {
          pop(taskQueue);
        }
      }
    } else {
      pop(taskQueue);  // callback 为 null（已取消），移除
    }

    currentTask = peek(taskQueue);
  }

  if (currentTask !== null) {
    return true;   // 还有任务，告诉调用方继续调度
  }
  return false;    // 全部完成
}
```

---

## React 触发更新的完整调度链路

```
用户点击按钮
    │
    ▼
dispatchSetState(fiber, queue, action)          // ReactFiberHooks.js
    │
    ├─ requestUpdateLane(fiber)                 // 根据事件上下文分配 Lane
    │   └─ 点击事件上下文 → SyncLane
    │
    ├─ enqueueConcurrentHookUpdate(...)         // 将 Update 推入队列
    │
    └─ scheduleUpdateOnFiber(root, fiber, lane) // ReactFiberWorkLoop.js
           │
           ├─ markRootUpdated(root, lane)       // 在 FiberRoot 上记录待处理 Lane
           │
           └─ ensureRootIsScheduled(root)
                  │
                  ├─ 计算 nextLanes（最高优先级）
                  ├─ lanesToEventPriority()     // Lane → Scheduler 优先级
                  │
                  └─ scheduleCallback(schedulerPriorityLevel, performConcurrentWorkOnRoot)
                         │
                         └─ 推入 taskQueue 最小堆
                                │
                                └─ MessageChannel → 下一个宏任务执行
                                       │
                                       └─ workLoopConcurrentByScheduler()
                                              │
                                              └─ 每个 performUnitOfWork 后检查 shouldYield()
```

---

## 对比其他框架

| | React | Vue 3 | SolidJS |
|---|---|---|---|
| 调度机制 | Scheduler（自研，时间切片） | `nextTick`（Promise/微任务） | 同步（无调度） |
| 优先级系统 | Lane 位掩码（31级） | 无 | 无 |
| 可中断 | ✅ Concurrent Mode | ❌ | ❌ |
| 时间切片粒度 | 5ms | N/A | N/A |
| 防饿死 | `expirationTime` 超时机制 | N/A | N/A |

Vue 3 使用微任务（`Promise.resolve().then(flushJobs)`），所有更新在同一个微任务批次中完成，无法跨帧中断；React 使用宏任务（MessageChannel），可在帧间让步。

---

## 关键要点

1. **Lane = 位掩码**：一个整数可表示多个并发更新的优先级集合，O(1) 合并/查询
2. **两个优先级系统**：Lane 在 Reconciler 层描述"紧急程度"，Scheduler 描述"执行时机"
3. **最小堆**：`taskQueue` 保证每次取出的都是最高优先级任务
4. **MessageChannel**：比 `setTimeout(0)` 延迟更低，且在宏任务中执行（不阻塞渲染）
5. **防饿死**：低优先级任务有 `expirationTime`，超时后强制执行（`didUserCallbackTimeout = true`）

---

## 下一章

→ [03. Hooks 实现机制](./03-hooks.md) — 了解 useState、useEffect 的内部数据结构
