# React 19.2 源码深度解读

> 专注于客户端渲染（CSR），不涉及 SSR。基于 React 19.2.4 实际源码。

## 目录

| 章节 | 文件 | 核心内容 |
|------|------|----------|
| 1. Fiber 架构与双缓冲 | [01-fiber.md](./01-fiber.md) | FiberNode 结构、双缓冲机制、树遍历 |
| 2. Scheduler & Lane 模型 | [02-scheduler-lane.md](./02-scheduler-lane.md) | 优先级位掩码、任务最小堆、时间切片 |
| 3. Hooks 实现机制 | [03-hooks.md](./03-hooks.md) | Hook 链表、useState、useEffect |
| 4. Diff 算法 | [04-diff.md](./04-diff.md) | 单节点/多节点 Diff、lastPlacedIndex |
| 5. Commit 阶段 | [05-commit.md](./05-commit.md) | 三个子阶段、subtreeFlags 优化 |
| 6. Concurrent Mode | [06-concurrent.md](./06-concurrent.md) | 可中断渲染、useTransition、优先级抢占 |

## 学习路径

```
基础路径:
Fiber 架构 (01) → Hooks 实现 (03) → Diff 算法 (04) → Commit 阶段 (05)

进阶路径:
上述基础 → Scheduler & Lane 模型(02) → Concurrent Mode (06)
```

## 整体架构

```
┌─────────────────────────────────────────────────────────────┐
│                     应用层（react）                          │
│  JSX → createElement → ReactElement                         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│              协调层（react-reconciler） 触发层                     │
│                                                              │
│  createRoot → createFiberRoot → FiberNode 树                │
│       ↓                                                      │
│  scheduleUpdateOnFiber → Lane 模型 优先级分配                    │
│       ↓                                                      │
│  Render Phase: beginWork → reconcileChildFibers (diff)      │
│                → completeWork → subtreeFlags 冒泡           │
│       ↓                                                      │
│  Commit Phase: Before Mutation → Mutation → Layout          │
│                → Passive Effects (useEffect)                │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│                 调度层（scheduler）                          │
│  taskQueue（最小堆）→ MessageChannel → 时间切片 5ms         │
└──────────────────────┬──────────────────────────────────────┘
                       │
┌──────────────────────▼──────────────────────────────────────┐
│               渲染层（react-dom/client）                     │
│  insertBefore / appendChild / updateProperties              │
└─────────────────────────────────────────────────────────────┘
```

## 面试题

| 章节 | 文件 | 题目范围 |
|------|------|----------|
| 面试题(一) Fiber & 调度 | [07-interview-fiber-scheduling.md](./07-interview-fiber-scheduling.md) | Q1-Q10：Fiber 架构、双缓冲、Lane、Scheduler、时间切片、setState 全链路 |
| 面试题(二) Hooks & 性能 | [08-interview-hooks-performance.md](./08-interview-hooks-performance.md) | Q11-Q20：Hooks 链表、useState 原理、批处理、useEffect、性能优化方案 |
| 面试题(三) Diff & 并发 | [09-interview-diff-concurrent.md](./09-interview-diff-concurrent.md) | Q21-Q30：Diff 算法、key 原理、Concurrent Mode、useTransition、Suspense、React 19 |

## 源码文件速查

| 功能 | 文件路径 | 关键函数 |
|------|----------|----------|
| Fiber 节点 | `packages/react-reconciler/src/ReactFiber.js` | `FiberNode`(L138)、`createWorkInProgress`(L327) |
| 工作循环 | `packages/react-reconciler/src/ReactFiberWorkLoop.js` | `workLoopSync`(L2745)、`workLoopConcurrentByScheduler`(L3046) |
| 向下遍历 | `packages/react-reconciler/src/ReactFiberBeginWork.js` | `beginWork`(L4161) |
| 向上归并 | `packages/react-reconciler/src/ReactFiberCompleteWork.js` | `completeWork`(L1068) |
| 提交副作用 | `packages/react-reconciler/src/ReactFiberCommitWork.js` | `commitMutationEffects`(L1980) |
| Hooks | `packages/react-reconciler/src/ReactFiberHooks.js` | `mountState`(L1922)、`updateState`(L1936) |
| Lane 优先级 | `packages/react-reconciler/src/ReactFiberLane.js` | Lane 常量(L43) |
| Diff 算法 | `packages/react-reconciler/src/ReactChildFiber.js` | `reconcileChildFibersImpl`(L1849) |
| 调度器 | `packages/scheduler/src/forks/Scheduler.js` | `unstable_scheduleCallback`(L327) |
| 根容器入口 | `packages/react-reconciler/src/ReactFiberReconciler.js` | `createContainer`(L235)、`updateContainer`(L353) |
