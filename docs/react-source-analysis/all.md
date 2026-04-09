学习
 
## React 函数式组件思想

React 函数式组件的本质是：

1. UI = f(state)
2. 渲染阶段必须尽量纯（不直接做 DOM 副作用）
3. 状态更新通过 Hook 队列描述，调度系统决定何时计算

在源码层面，函数组件并不是“特殊语法”，而是被 Fiber 解释执行：

- 进入组件时，React 通过 `renderWithHooks` 挂接 Hook dispatcher，按调用顺序读取/写入 Hook 链表。
- 每次 `setState` 只是创建 update 并标上 lane（优先级），不会立刻同步改 DOM。
- 渲染输出是新的 ReactElement 树，之后进入协调（reconcile）与提交（commit）。

关键入口：

- `packages/react-reconciler/src/ReactFiberHooks.js:502` `renderWithHooks`
- `packages/react-reconciler/src/ReactFiberHooks.js:1922` `mountState`
- `packages/react-reconciler/src/ReactFiberHooks.js:1936` `updateState`
- `packages/react-reconciler/src/ReactFiberHooks.js:3598` `dispatchSetState`

一句话理解：函数组件每次执行都像“重新求值”，而 Fiber + Hook 链表保证你得到“增量、可中断、可恢复”的结果。

## Fiber 架构设计（fiber 节点，树结构，调度机制，双循环）

Fiber 是 React 的增量渲染数据结构。每个 Fiber 节点对应一个工作单元（组件实例/宿主节点/片段等），保存：

- 组件类型与 props
- 状态与更新队列
- 副作用标记（flags）
- 树关系（child/sibling/return）

### 1. Fiber 节点与双缓冲

React 使用 current/workInProgress 两棵镜像树实现双缓冲：

- `current`：当前屏幕上已提交的树
- `workInProgress`：本次正在计算的新树

核心在 `createWorkInProgress`：

- `packages/react-reconciler/src/ReactFiber.js:327`

这让 React 可以在渲染阶段中断、恢复，甚至丢弃未完成结果，而不污染已显示 UI。

### 2. 树结构与遍历双循环

渲染阶段是经典“深度优先两次到达”模型：

1. begin 阶段（向下）：计算子节点，决定下一步去哪
2. complete 阶段（向上）：回收子树结果，汇总副作用

对应源码：

- `packages/react-reconciler/src/ReactFiberBeginWork.js:4161` `beginWork`
- `packages/react-reconciler/src/ReactFiberCompleteWork.js:1068` `completeWork`
- `packages/react-reconciler/src/ReactFiberWorkLoop.js:2745` `workLoopSync`

常见理解误区：React 不是“递归一次就结束”，而是在 work loop 里不断推进 fiber 指针，形成可打断的循环。

### 3. 调度机制：Scheduler + Lane

React 19 CSR 调度可简化为两层：

1. Scheduler 负责“何时执行任务”（时间维度）
2. Lane 负责“先执行谁”（优先级维度）

关键点：

- Scheduler 任务入队：
  - `packages/scheduler/src/forks/Scheduler.js:327` `unstable_scheduleCallback`
  - `packages/scheduler/src/forks/Scheduler.js:260` `unstable_runWithPriority`
- Lane 选择与根更新：
  - `packages/react-reconciler/src/ReactFiberLane.js:756` `getHighestPriorityLane`
  - `packages/react-reconciler/src/ReactFiberLane.js:825` `markRootUpdated`

Lane 的意义是把“更新来源”映射成可组合的位掩码，支持批处理、抢占和避免饥饿。

### Hooks 实现机制

Hooks 的核心是“按调用顺序对齐”的单向链表，不靠名字而靠位置。

数据结构（概念上）：

- Fiber 上挂一条 Hook 链
- 每个 Hook 节点保存 memoizedState、baseState、queue

关键流程：

1. 首次渲染：`mountState` 创建 Hook 节点和 queue
2. 更新渲染：`updateState` 消费 queue，按 lane 过滤可处理 update
3. 调用 `setState`：`dispatchSetState` 创建 update，尝试 eager 计算，最后调度 root

源码锚点：

- `packages/react-reconciler/src/ReactFiberHooks.js:1922` `mountState`
- `packages/react-reconciler/src/ReactFiberHooks.js:1936` `updateState`
- `packages/react-reconciler/src/ReactFiberHooks.js:3628` `dispatchSetStateInternal`

这解释了两个常见现象：

- 不能在条件分支里调用 Hook（顺序会错位）
- 多次 setState 在一个事件里会被批处理

### 初次挂载流程

可按下面链路理解：

1. 触发 root 渲染，创建 root 的 workInProgress
2. 进入 work loop，不断 `beginWork -> completeWork`
3. 函数组件在 begin 阶段进入 `renderWithHooks`
4. 子元素通过 child reconciliation 转成 Fiber 子链
5. 渲染阶段结束后进入 commit

关键位置：

- `packages/react-reconciler/src/ReactFiberWorkLoop.js`（work loop 主流程）
- `packages/react-reconciler/src/ReactFiberHooks.js:502` `renderWithHooks`
- `packages/react-reconciler/src/ReactChildFiber.js:2028` `reconcileChildFibers`

### 更新流程

以 `setState` 为例：

1. `dispatchSetState` 创建 update 并请求 lane
2. update 入队，标记 root 对应 lane 已更新
3. `ensureRootIsScheduled` 让 root 在合适优先级下进入调度
4. 渲染阶段按 lane 选择性处理 update（低优先级可延后）
5. 生成新树并在 commit 应用副作用

关键位置：

- `packages/react-reconciler/src/ReactFiberHooks.js:3598` `dispatchSetState`
- `packages/react-reconciler/src/ReactFiberLane.js:825` `markRootUpdated`
- `packages/react-reconciler/src/ReactFiberWorkLoop.js`（多处 `ensureRootIsScheduled`）

为什么 React 看起来“有时同步、有时异步”：

- 不是随机，而是由事件类型、lane 优先级和当前执行上下文共同决定。

### Commit 阶段

Commit 是不可中断阶段，目标是把渲染结果落地。通常分为：

1. before mutation：读取提交前信息
2. mutation：执行 DOM 插入/删除/更新
3. layout：执行 layout effect、ref 附着

源码锚点：

- `packages/react-reconciler/src/ReactFiberCommitWork.js:1980` `commitMutationEffects`
- `packages/react-reconciler/src/ReactFiberCommitWork.js:2951` `commitLayoutEffects`

一句话总结：render 决定“该变什么”，commit 负责“真正去变”。

## 阅读建议（React 19 CSR）

推荐阅读顺序：

1. `ReactFiber.js` 理解 Fiber 节点与双缓冲
2. `ReactFiberWorkLoop.js` 理解渲染主循环
3. `ReactFiberBeginWork.js`/`ReactFiberCompleteWork.js` 理解下潜与归并
4. `ReactFiberHooks.js` 跑通 useState/useEffect
5. `ReactFiberLane.js` 理解优先级与并发调度
6. `ReactFiberCommitWork.js` 理解副作用落地

调试技巧：

- 在 `renderWithHooks`、`dispatchSetState`、`beginWork`、`commitMutationEffects` 打断点
- 观察同一组件在 current 与 workInProgress 的字段差异
- 结合 lane 位掩码变化看“为什么这次更新先执行/后执行”

