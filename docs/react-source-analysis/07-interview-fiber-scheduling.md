# React 源码面试题 — 第一部分：Fiber 架构 & 调度系统

> 基于 React 19.2 源码，配合回答 SOP（标准回答流程）。
> 每题提供：**题目 → 考察点 → 回答 SOP → 标准答案 → 加分项 → 踩坑点**

---

## 目录

- [Q1. 什么是 Fiber？为什么 React 要从递归架构迁移到 Fiber 架构？](#q1)
- [Q2. FiberNode 有哪些关键字段？分别起什么作用？](#q2)
- [Q3. 什么是双缓冲（Double Buffering）？React 中如何实现的？](#q3)
- [Q4. Fiber 树的遍历方式是怎样的？为什么不用递归？](#q4)
- [Q5. React 的 Lane 模型是什么？为什么用位掩码而不是数字表示优先级？](#q5)
- [Q6. Scheduler 调度器的核心数据结构和调度流程是什么？](#q6)
- [Q7. React 的时间切片（Time Slicing）是如何实现的？为什么用 MessageChannel？](#q7)
- [Q8. 一次 setState 从触发到页面更新，经历了哪些步骤？](#q8)
- [Q9. React 中 render 阶段和 commit 阶段有什么区别？](#q9)
- [Q10. beginWork 和 completeWork 分别做了什么？](#q10)

---

<a id="q1"></a>
## Q1. 什么是 Fiber？为什么 React 要从递归架构迁移到 Fiber 架构？

### 考察点
架构设计理解、可中断渲染、性能优化意识

### 回答 SOP（30秒版 → 2分钟版 → 5分钟版）

**30秒版**：
> Fiber 是 React 16 引入的新架构，核心思想是把渲染工作拆分成一个个可中断的工作单元。每个 FiberNode 对应一个组件或 DOM 节点，用链表（child/sibling/return）串联。旧架构用递归遍历 VDOM，一旦开始就无法中断，长任务会卡死主线程。Fiber 架构改用迭代遍历，每个工作单元执行完可以检查是否需要让出主线程。

**2分钟版（在上面基础上追加）**：
> 具体来说，Fiber 解决了三个问题：
> 1. **可中断**：每个 FiberNode 就是一个工作单元，`performUnitOfWork` 处理完一个后，可以通过 `shouldYield()` 检查是否超过 5ms 时间片，超过则让出主线程；
> 2. **优先级**：通过 Lane 模型给不同更新分配优先级，高优先级（用户输入）可以打断低优先级（数据加载）的渲染；
> 3. **增量渲染**：配合双缓冲机制（current tree / workInProgress tree），在后台构建新树，出错时可以丢弃 workInProgress 而不影响当前显示。

**5分钟版（面试官追问时展开）**：
> 在源码中，FiberNode 定义在 `ReactFiber.js` L138，关键字段包括：
> - `tag`：节点类型（FunctionComponent=0, HostComponent=5 等）
> - `child/sibling/return`：链表结构实现深度优先遍历
> - `alternate`：指向双缓冲树中的对应节点
> - `flags/subtreeFlags`：副作用标记（Placement/Update/Deletion），commit 阶段用于决定哪些节点需要 DOM 操作
> - `lanes`：优先级，32 位整数中的位掩码
>
> 工作循环在 `ReactFiberWorkLoop.js` 中，同步模式用 `workLoopSync`（L2745，不中断），并发模式用 `workLoopConcurrentByScheduler`（L3046，每 5ms 检查 `shouldYield()`）。

### 加分项
- 提到"Fiber"这个词来自于操作系统概念中的"协程/纤程"（Fiber = lightweight thread），表示可以被调度系统暂停和恢复
- 提到 React 16 之前的 Stack Reconciler 是递归的（`mountComponent → mountComponent → ...`），调用栈深度等于组件树深度
- 能说出 React 团队分了两年（2016-2018）才完成这个重写

### 踩坑点
- ❌ 不要说"Fiber 让渲染更快了"——实际上单次渲染可能更慢（多了调度开销），但**用户感知**更流畅
- ❌ 不要把 Fiber 和 Virtual DOM 混淆——Fiber 是架构，VDOM 是概念
- ❌ 不要说所有更新都可中断——同步更新（SyncLane）走 `workLoopSync`，不可中断

---

<a id="q2"></a>
## Q2. FiberNode 有哪些关键字段？分别起什么作用？

### 考察点
数据结构理解、源码阅读深度

### 回答 SOP

按**分类**来讲，不要零散列举：

```
1. 身份信息：tag（节点类型）、type（组件函数/类/"div"）、key
2. 树结构：child（第一个子）、sibling（兄弟）、return（父）、index
3. 双缓冲：alternate（current ↔ workInProgress）
4. 状态：memoizedState（hooks链表/class state）、memoizedProps、pendingProps
5. 副作用：flags（自身）、subtreeFlags（子树汇总）、deletions
6. 优先级：lanes（自身）、childLanes（子树）
7. DOM 关联：stateNode（真实 DOM 或类组件实例）
```

### 标准答案

| 分类 | 字段 | 作用 |
|------|------|------|
| 身份 | `tag` | 节点类型枚举：FunctionComponent=0, ClassComponent=1, HostRoot=3, HostComponent=5 |
| 身份 | `type` | 函数组件是函数本身，类组件是类，DOM 节点是字符串（如 "div"） |
| 身份 | `key` | Diff 时用于识别可复用节点 |
| 树结构 | `child` | 第一个子 Fiber |
| 树结构 | `sibling` | 下一个兄弟 Fiber |
| 树结构 | `return` | 父 Fiber（不叫 parent，因为这是一个回溯指针） |
| 双缓冲 | `alternate` | 指向另一棵缓冲树中的对应节点 |
| 状态 | `memoizedState` | **函数组件**：Hook 链表头节点；**类组件**：state 对象 |
| 状态 | `pendingProps` / `memoizedProps` | 本次渲染的新 props / 上次渲染的 props |
| 副作用 | `flags` | 位掩码标记：Placement(插入), Update(更新), Deletion(删除) |
| 副作用 | `subtreeFlags` | 子树 flags 的汇总（completeWork 阶段冒泡），commit 时用于跳过无副作用子树 |
| 优先级 | `lanes` | 32 位整数，每一位代表一个优先级 Lane |
| DOM | `stateNode` | HostComponent 指向真实 DOM；HostRoot 指向 FiberRoot；ClassComponent 指向实例 |

### 加分项
- 能说出 `return` 而不是 `parent`，解释这是 Fiber 作为工作单元"完成后返回"的语义
- 提到 `subtreeFlags` 是 React 18 的优化，替代了之前的 `firstEffect/lastEffect` 链表
- 提到 `memoizedState` 的多义性（函数组件是 hooks，类组件是 state）

---

<a id="q3"></a>
## Q3. 什么是双缓冲（Double Buffering）？React 中如何实现的？

### 考察点
性能优化、错误恢复、内存管理

### 回答 SOP

**第一步：类比**
> 双缓冲就像电影后期制作：一条底片正在放映（current tree），另一条在后台剪辑（workInProgress tree）。剪辑完成后切换放映底片。

**第二步：机制**
> React 中，每个 FiberNode 有个 `alternate` 字段，指向另一棵树中的对应节点。`FiberRoot.current` 指向当前显示的树。
> - 首次渲染：创建 workInProgress tree
> - 更新时：`createWorkInProgress()` 尝试复用已有的 `alternate` 节点，只更新 `pendingProps` 和清除 `flags`
> - Commit 结束：`root.current = finishedWork`，一行代码完成切换

**第三步：作用**
> 1. **无闪烁**：后台构建完整才切换，用户不会看到中间状态
> 2. **错误恢复**：渲染出错直接丢弃 workInProgress，current tree 仍然有效
> 3. **内存复用**：`alternate` 节点循环使用，避免大量 GC

### 加分项
- 提到 `createWorkInProgress`（ReactFiber.js L327）的对象池机制：`alternate === null` 时创建新节点，否则复用
- 提到切换时机在 Mutation 之后、Layout 之前：`root.current = finishedWork`
- 解释为什么在 Layout 之前切换：确保 `componentDidMount` / `useLayoutEffect` 读到的已是新树

### 踩坑点
- ❌ 不要说有"两棵完全独立的树"——实际上未变化的子树通过 `child = current.child` 共享
- ❌ 不要说 alternate 总是存在——首次渲染时 `alternate === null`

---

<a id="q4"></a>
## Q4. Fiber 树的遍历方式是怎样的？为什么不用递归？

### 考察点
算法设计、可中断原理

### 回答 SOP

**核心**：深度优先，迭代（非递归），使用 `child/sibling/return` 三个指针模拟调用栈。

```
遍历规则：
1. 有 child → 向下（beginWork）
2. 无 child → completeWork，然后看 sibling
3. 有 sibling → 走向兄弟（beginWork）
4. 无 sibling → 回到 return（继续 completeWork）
5. 回到根节点 → 结束
```

**为什么不用递归**：
- 递归用的是 **JS 调用栈**（固定大小，不可控），无法在中途"暂停"
- 迭代用 **Fiber 链表作为"手动栈"**，随时可以停在某个 `workInProgress` 节点上
- 下次恢复时，直接从 `workInProgress` 继续，不需要重建调用栈

**示例**：

```
App                    beginWork(App)
├── Header               beginWork(Header) → completeWork(Header)
└── Main                 beginWork(Main)
    ├── Sidebar            beginWork(Sidebar) → completeWork(Sidebar)
    └── Content            beginWork(Content) → completeWork(Content)
                         completeWork(Main)
                       completeWork(App)
```

### 加分项
- 说出 `performUnitOfWork`（ReactFiberWorkLoop.js L3054）是驱动遍历的函数
- 提到 `completeWork` 阶段会执行 `bubbleProperties`（将子树 flags 冒泡到 `subtreeFlags`）

---

<a id="q5"></a>
## Q5. React 的 Lane 模型是什么？为什么用位掩码而不是数字表示优先级？

### 考察点
优先级系统设计、位运算理解

### 回答 SOP

**第一步：是什么**
> Lane 是 React 用来标记更新优先级的位掩码模型，定义在 `ReactFiberLane.js`。一共 31 条 Lane（32 位整型），值越小优先级越高。

**第二步：关键 Lane**
> - `SyncLane`（0b...010）：最高优先级，用户输入（点击）
> - `InputContinuousLane`：连续输入（滚动、拖拽）
> - `DefaultLane`：普通 setState
> - `TransitionLanes`（16条）：useTransition
> - `IdleLane`：空闲时执行

**第三步：为什么用位掩码**
> 数字优先级只能表示单一优先级（`priority = 3`），而位掩码可以：
> - **合并**：`pendingLanes |= newLane`（O(1)）
> - **检查包含**：`(lanes & lane) !== 0`（O(1)）
> - **取最高优先级**：`lanes & -lanes`（取最低位的 1，O(1)）
> - **移除**：`lanes &= ~lane`（O(1)）
>
> 这些操作如果用数组/集合实现需要 O(n)。

### 加分项
- 提到 `TransitionLanes` 有 16 条：因为多个 `startTransition` 可能并发，每个分配独立 Lane 避免互相干扰
- 提到 Lane 和 Scheduler Priority 是两层系统：Lane 在 Reconciler 层表示"紧急程度"，Scheduler Priority 表示"执行时机"
- 提到 `getHighestPriorityLane = lanes & -lanes`（取最低位的 1 = 最高优先级）这个位运算技巧
- 提到防饿死机制：每个 Lane 有对应的过期时间，超时后升级为 SyncLane 强制执行

### 踩坑点
- ❌ 不要说"Lane 就是一个数字优先级"——它是**集合**（可以同时包含多个 Lane）
- ❌ 不要把 Lane 和 Scheduler 的 5 个优先级混淆——它们是两层系统

---

<a id="q6"></a>
## Q6. Scheduler 调度器的核心数据结构和调度流程是什么？

### 考察点
任务调度、数据结构（最小堆）

### 回答 SOP

**第一步：数据结构**
> Scheduler 用两个**最小堆**管理任务：
> - `taskQueue`：当前可执行的任务，按 `expirationTime` 排序
> - `timerQueue`：延迟任务，按 `startTime` 排序
>
> 每个 Task 包含：`id`（单调递增）、`callback`（要执行的工作）、`priorityLevel`、`startTime`、`expirationTime`（防饿死）、`sortIndex`（堆排序键）。

**第二步：调度流程**
> ```
> scheduleCallback(priority, callback)
>   → 计算 expirationTime（startTime + timeout[priority]）
>   → push 到 taskQueue（最小堆）
>   → requestHostCallback → MessageChannel.postMessage()
>   → 让出主线程
>   → 下一个宏任务中执行 workLoop
>     → peek(taskQueue) 取堆顶
>     → 执行 callback
>     → callback 返回函数 → 未完成，保留
>     → callback 返回 null → 完成，pop
>     → shouldYield() → 超过 5ms，中断
> ```

**第三步：5 个优先级的超时时间**
> | 优先级 | timeout |
> |--------|---------|
> | Immediate | -1（立即过期）|
> | UserBlocking | 250ms |
> | Normal | 5000ms |
> | Low | 10000ms |
> | Idle | MAX_INT（永不过期）|

### 加分项
- 解释为什么用最小堆（O(1) 取最小值，O(log n) 插入/删除）而不是数组排序（O(n log n)）
- 提到"防饿死"：低优先级任务的 `expirationTime` 到了之后，`didUserCallbackTimeout = true`，强制同步执行

---

<a id="q7"></a>
## Q7. React 的时间切片（Time Slicing）是如何实现的？为什么用 MessageChannel 而不是 setTimeout？

### 考察点
浏览器事件循环、宏任务/微任务

### 回答 SOP

**第一步：实现方式**
> React Scheduler 在每帧分配 **5ms** 时间片（`frameYieldMs = 5`）。渲染循环（`workLoopConcurrent`）中每处理完一个 Fiber 就检查 `shouldYield()`，如果 `performance.now() >= deadline` 则退出循环，通过 `MessageChannel.postMessage()` 安排下一次执行。

**第二步：为什么不用 setTimeout**
> | | `setTimeout(fn, 0)` | `MessageChannel` |
> |---|---|---|
> | 最低延迟 | 4ms（被浏览器 clamped）| ~0.1ms |
> | 执行时机 | 宏任务 | 宏任务 |
> | 嵌套限制 | 嵌套 5 次后被强制 4ms | 无限制 |
>
> `setTimeout(0)` 实际延迟是 4ms（规范规定嵌套 5 次后最小 4ms），而 `MessageChannel` 没有这个限制，在高频调度场景中积少成多差别很大。

**第三步：为什么不用 requestAnimationFrame / requestIdleCallback**
> - `rAF`：绑定刷新率（16.6ms），React 需要更细粒度的控制
> - `rIC`：浏览器兼容性差 + 执行时间不可控（可能延迟 50ms+）
> - `微任务（Promise.then）`：在当前宏任务结束前执行，不会让出主线程给浏览器渲染

### 加分项
- 能画出完整的事件循环图示：`宏任务 → 微任务 → 渲染 → 下一个宏任务`
- 提到 React 18 之后实际上也使用了微任务（`queueMicrotask`）来处理同步更新的批处理

---

<a id="q8"></a>
## Q8. 一次 setState 从触发到页面更新，经历了哪些步骤？（完整链路）

### 考察点
全局架构理解、串联能力（面试高频必考！）

### 回答 SOP

这是**最重要的串联题**，建议用"编号 + 源码定位"的方式答：

```
① 触发：setCount(1)
   → dispatchSetState(fiber, queue, action)            [ReactFiberHooks.js]

② 创建 Update：
   → requestUpdateLane(fiber)                          分配优先级（如 SyncLane）
   → 创建 Update 对象 { lane, action, next }
   → Eager State 优化：如果新值 === 旧值，直接 return，不触发渲染！

③ 入队 + 调度：
   → enqueueConcurrentHookUpdate(fiber, queue, update, lane)  推入环形链表
   → scheduleUpdateOnFiber(root, fiber, lane)          [ReactFiberWorkLoop.js]
   → markRootUpdated(root, lane)                        在 FiberRoot 记录待处理 Lane
   → ensureRootIsScheduled(root)                        开始调度

④ Scheduler 任务调度：
   → lanesToEventPriority()                            Lane → Scheduler 优先级
   → scheduleCallback(priority, performConcurrentWorkOnRoot)
   → MessageChannel.postMessage()                       让出主线程

⑤ Render 阶段（可中断）：
   → createWorkInProgress(current, pendingProps)        创建/复用 workInProgress
   → workLoopSync() 或 workLoopConcurrentByScheduler()
       → performUnitOfWork(workInProgress)              循环处理每个 Fiber
           → beginWork(current, wip, lanes)             向下：执行组件 render，Diff 子节点
           → completeWork(current, wip, lanes)          向上：创建 DOM，冒泡 subtreeFlags

⑥ Commit 阶段（不可中断）：
   → commitBeforeMutationEffects()                     getSnapshotBeforeUpdate
   → commitMutationEffects()                           DOM 插入/更新/删除
   → root.current = finishedWork                        切换双缓冲树
   → commitLayoutEffects()                              useLayoutEffect / componentDidMount

⑦ 浏览器绘制

⑧ Passive Effects（异步）：
   → flushPassiveEffects()                              useEffect cleanup + callback
```

### 加分项
- 能说出 Eager State 优化（`Object.is` 比较新旧值相同时跳过）
- 区分 SyncLane 走 `workLoopSync`（不可中断）和 TransitionLane 走 `workLoopConcurrent`（可中断）
- 提到批处理：React 18 中多个 setState 会被合并到一次渲染

### 踩坑点
- ❌ 不要说"setState 是异步的"——它是同步执行的，只是渲染可能被批处理延迟
- ❌ 不要漏掉 commit 阶段的三个子阶段（Before Mutation / Mutation / Layout）

---

<a id="q9"></a>
## Q9. React 中 render 阶段和 commit 阶段有什么区别？

### 考察点
两阶段架构理解

### 回答 SOP

| 维度 | Render 阶段 | Commit 阶段 |
|------|------------|-------------|
| **做什么** | 构建 workInProgress Fiber 树，Diff 找出变化 | 将变化应用到真实 DOM |
| **可中断** | ✅ 并发模式下可中断 | ❌ 不可中断（操作真实 DOM，必须原子性） |
| **纯函数** | ✅ 不产生副作用，相同输入相同输出 | ❌ 有副作用（DOM 操作、生命周期回调） |
| **核心函数** | `beginWork` + `completeWork` | `commitMutationEffects` + `commitLayoutEffects` |
| **结果** | 打上 flags 标记（Placement/Update/Deletion） | 执行标记对应的 DOM 操作 |
| **执行次数** | 可能执行多次（因为中断后重新开始） | 只执行一次 |
| **子阶段** | beginWork（向下）+ completeWork（向上） | Before Mutation → Mutation → Layout |

### 加分项
- 提到 Render 阶段可能"执行多次"：因为高优先级抢占后，之前的 workInProgress 被丢弃，重新从 current 开始
- 这也是为什么 Render 阶段不能有副作用——多次执行会重复触发副作用
- 提到 commit 阶段之所以不可中断：如果中途暂停，用户看到"半完成"的 DOM 状态

---

<a id="q10"></a>
## Q10. beginWork 和 completeWork 分别做了什么？

### 考察点
Render 阶段细节

### 回答 SOP

**beginWork**（`ReactFiberBeginWork.js` L4161）：
> 1. 根据 `fiber.tag` switch 分发到不同处理函数
> 2. 执行组件的 render 逻辑（函数组件调用函数，类组件调用 `render()`）
> 3. **Diff 子节点**：调用 `reconcileChildren` → `reconcileChildFibers`
> 4. 给变化的子节点打上 `flags`（Placement/Update/Deletion）
> 5. 返回第一个子 Fiber（交给 `performUnitOfWork` 继续向下）
>
> 优化：如果 `current !== null` 且 `props/state/context` 都没变，可以 `bailoutOnAlreadyFinishedWork`（跳过这个节点及整个子树）

**completeWork**（`ReactFiberCompleteWork.js` L1068）：
> 1. 对 HostComponent（如 "div"）：创建或更新真实 DOM 节点
> 2. 收集变化的 DOM 属性（但不立即应用，留给 commit 阶段）
> 3. **冒泡 subtreeFlags**：`bubbleProperties()` —— 将子节点的 `flags` 合并到父节点的 `subtreeFlags`
> 4. 返回 null，遍历转向 `sibling` 或 `return`

### 加分项
- 提到 `bailoutOnAlreadyFinishedWork`：如果 `childLanes` 中没有待处理的更新，可以跳过**整个子树**，这是非常关键的性能优化
- 提到 `subtreeFlags` 冒泡的意义：commit 阶段遍历时，如果 `subtreeFlags === NoFlags`，可以直接跳过子树
