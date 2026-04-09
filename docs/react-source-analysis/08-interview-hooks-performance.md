# React 源码面试题 — 第二部分：Hooks & 性能优化

> 每题提供：**题目 → 考察点 → 回答 SOP → 标准答案 → 加分项 → 踩坑点**

---

## 目录

- [Q11. Hooks 的底层数据结构是什么？为什么不能在条件语句中使用？](#q11)
- [Q12. useState 的完整实现原理？mount 和 update 有什么区别？](#q12)
- [Q13. 调用 setState 后，React 如何判断是否需要重新渲染？](#q13)
- [Q14. 多次调用 setState 会触发几次渲染？批处理机制是怎样的？](#q14)
- [Q15. useEffect 和 useLayoutEffect 有什么区别？从源码角度解释执行时机](#q15)
- [Q16. useEffect 的依赖对比是如何实现的？为什么用浅比较？](#q16)
- [Q17. useRef 为什么不会触发重新渲染？它在源码中是怎么实现的？](#q17)
- [Q18. useMemo 和 useCallback 的实现原理？什么时候该用，什么时候不该用？](#q18)
- [Q19. React.memo 的原理是什么？和 useMemo 有什么区别？](#q19)
- [Q20. React 怎么做性能优化？请从源码角度给出至少 5 个方案](#q20)

---

<a id="q11"></a>
## Q11. Hooks 的底层数据结构是什么？为什么不能在条件语句中使用？

### 考察点
核心数据结构理解、Hooks 规则的底层原因

### 回答 SOP

**第一步：数据结构**
> 每个函数组件的 `fiber.memoizedState` 指向一个 **Hook 链表**的头节点。每个 Hook 节点包含：
> ```
> {
>   memoizedState: any,   // 状态值（useState 是值，useEffect 是 effect 对象，useRef 是 {current}）
>   baseState: any,       // 用于优先级中断时的基准状态
>   baseQueue: Update,    // 被跳过的低优先级更新
>   queue: UpdateQueue,   // 更新队列（环形链表）
>   next: Hook | null,    // 指向下一个 Hook
> }
> ```

**第二步：链表顺序**
> 对于这样的组件：
> ```jsx
> function Counter() {
>   const [count, setCount] = useState(0);    // Hook 1
>   const [name, setName] = useState('React');// Hook 2
>   useEffect(() => {...}, [count]);           // Hook 3
> }
> ```
> 链表为：`fiber.memoizedState → Hook1(count) → Hook2(name) → Hook3(effect) → null`

**第三步：为什么不能在条件语句中使用**
> Mount 阶段用 `mountWorkInProgressHook` 按顺序创建链表。
> Update 阶段用 `updateWorkInProgressHook` 按**同样的顺序**从链表中取节点。
>
> 如果你写：
> ```jsx
> if (condition) {
>   const [a, setA] = useState(0); // 条件为 false 时跳过
> }
> const [b, setB] = useState(0);
> ```
> 当 `condition` 从 true 变 false 时，第二次渲染从链表取第一个节点却拿到了 `a` 的 Hook 给了 `b`——**全部错位**！

### 加分项
- 提到 React 有两套 dispatcher：`HooksDispatcherOnMount`（mount 创建节点）和 `HooksDispatcherOnUpdate`（update 复用节点）
- 提到开发环境下 React 会检测 Hook 调用数量是否一致（使用额外的 `HooksDispatcherOnRerender`）
- 提到 `eslint-plugin-react-hooks` 的 `rules-of-hooks` 规则就是为此设计的

---

<a id="q12"></a>
## Q12. useState 的完整实现原理？mount 和 update 有什么区别？

### 考察点
状态管理核心机制

### 回答 SOP

**Mount 阶段**（`mountState` — ReactFiberHooks.js L1922）：
> 1. `mountWorkInProgressHook()` 创建新 Hook 节点，追加到链表
> 2. 如果 initialState 是函数，调用它获取初始值（**惰性初始化**）
> 3. 设置 `hook.memoizedState = hook.baseState = initialState`
> 4. 创建 `queue`（更新队列）：`{ pending: null, dispatch: null, lastRenderedReducer, lastRenderedState }`
> 5. 绑定 `dispatch = dispatchSetState.bind(null, fiber, queue)`
> 6. 返回 `[hook.memoizedState, dispatch]`

**dispatchSetState**（触发更新）：
> 1. `requestUpdateLane` 分配优先级（SyncLane / TransitionLane）
> 2. 创建 Update 对象：`{ lane, action, next }`
> 3. **Eager State 优化**：如果当前没有待处理更新，提前计算新值并与旧值 `Object.is` 比较，相同则直接 return
> 4. `enqueueConcurrentHookUpdate` 推入并发队列
> 5. `scheduleUpdateOnFiber` 调度渲染

**Update 阶段**（`updateState` L1936 → `updateReducer`）：
> 1. `updateWorkInProgressHook()` 按顺序取链表中对应的 Hook 节点
> 2. 取出 `queue.pending`（环形链表），展开合并到 `baseQueue`
> 3. 遍历 Update 链表：
>    - 优先级足够 → 执行 `reducer(state, action)` 计算新 state
>    - 优先级不足 → 跳过，保留到 baseQueue 等下次处理
> 4. 更新 `hook.memoizedState`
> 5. 返回 `[newState, dispatch]`

> 关键洞察：**useState 本质上是 `useReducer(basicStateReducer, initialState)`**，其中 `basicStateReducer = (state, action) => typeof action === 'function' ? action(state) : action`。

### 加分项
- 解释"环形链表"（`queue.pending` 总是指向最后一个 Update，`pending.next` 指向第一个）
- 解释为什么用环形链表：O(1) 尾部插入，且 O(1) 获取头尾
- 提到 Eager State 优化是 React 18 加入的性能重要优化

---

<a id="q13"></a>
## Q13. 调用 setState 后，React 如何判断是否需要重新渲染？

### 考察点
性能优化意识

### 回答 SOP

React 有**两道防线**来避免不必要的渲染：

**第一道：Eager State（`dispatchSetState` 中）**
> 如果 `fiber.lanes === NoLanes`（当前没有待处理更新），React 会：
> 1. 立即用 `lastRenderedReducer(currentState, action)` 计算新值
> 2. 用 `Object.is(eagerState, currentState)` 比较
> 3. 相同 → **直接 return，不触发任何调度！**
>
> 这是最高效的优化——连 `scheduleUpdateOnFiber` 都不会调用。

**第二道：bailout in beginWork**
> 如果 Eager State 没能拦截（比如已有其他待处理更新），进入 Render 阶段后：
> 1. `beginWork` 检查：`oldProps === newProps && !hasContextChanged && !includesSomeLane(renderLanes, updateLanes)`
> 2. 如果都满足 → `bailoutOnAlreadyFinishedWork`：跳过当前组件 render
> 3. 进一步检查 `childLanes`：如果子树也无更新 → 直接返回 null，跳过整个子树

**注意事项**：
> - `Object.is` 而不是 `===`：区别在于 `Object.is(NaN, NaN) === true` 和 `Object.is(+0, -0) === false`
> - 即使新旧值相同，如果已有待处理更新（`fiber.lanes !== NoLanes`），第一道防线不生效，会进入 Render 阶段（但第二道可能拦截）

### 踩坑点
- ❌ "setState 相同值不会重新渲染"——不完全正确，有时会进入 render 但不 commit
- ❌ 不要说"React 用 deep equal 比较"——是 `Object.is`（引用比较 + 特殊值处理）

---

<a id="q14"></a>
## Q14. 多次调用 setState 会触发几次渲染？批处理机制是怎样的？

### 考察点
React 18 Automatic Batching

### 回答 SOP

**React 18 之前**：只在 React 事件处理器内批处理
```jsx
// React 17：
function handleClick() {
  setCount(c => c + 1);  // 不会立即渲染
  setName('React');      // 不会立即渲染
  // handleClick 结束时，批量渲染一次
}

setTimeout(() => {
  setCount(c => c + 1);  // 立即渲染！
  setName('React');      // 又渲染一次！
  // 共 2 次渲染 ❌
}, 0);
```

**React 18（createRoot）：所有地方都自动批处理**
```jsx
// React 18：
setTimeout(() => {
  setCount(c => c + 1);  // 批处理
  setName('React');      // 批处理
  // 共 1 次渲染 ✅
}, 0);

fetch('/api').then(() => {
  setCount(c => c + 1);  // 批处理
  setName('React');      // 批处理
  // 共 1 次渲染 ✅
});
```

**原理**：
> 每次 `dispatchSetState` 只做三件事：创建 Update → 入队 → 调用 `scheduleUpdateOnFiber`。
> `ensureRootIsScheduled` 会检查是否已经有调度任务在进行，如果有则直接 return（不重复调度）。
> 所有同步触发的 setState 的 Update 都会先入队，等当前宏任务/微任务结束后统一调度一次渲染。

**如何强制不批处理？**
```jsx
import { flushSync } from 'react-dom';

flushSync(() => {
  setCount(c => c + 1);  // 立即渲染
});
// 此时 DOM 已更新
flushSync(() => {
  setName('React');      // 再渲染一次
});
```

### 加分项
- 提到 React 18 使用"微任务"来统一调度：`queueMicrotask(processRootScheduleInMicrotask)`
- 提到 `flushSync` 会立即触发同步渲染（跳过调度，直接 `performSyncWorkOnRoot`）

---

<a id="q15"></a>
## Q15. useEffect 和 useLayoutEffect 有什么区别？从源码角度解释执行时机

### 考察点
副作用机制、浏览器渲染流程

### 回答 SOP

| | `useEffect` | `useLayoutEffect` |
|---|---|---|
| **Hook flags** | `HookPassive` | `HookLayout` |
| **Fiber flags** | `PassiveEffect` | `UpdateEffect` |
| **执行时机** | commit 结束后**异步**（Scheduler NormalPriority） | commit Mutation 后、Layout 阶段中**同步** |
| **阻塞绘制** | ❌ 不阻塞 | ✅ 阻塞（在浏览器 paint 前执行） |
| **用途** | 数据请求、订阅、日志 | 读取 DOM 尺寸、同步动画、Tooltip 定位 |
| **SSR 安全** | ✅ | ⚠️（会有警告，因为服务端无 DOM） |

**时序图**：
```
Render 阶段 → Commit 开始
  → Before Mutation（getSnapshotBeforeUpdate）
  → Mutation（DOM 增删改）
  → root.current = finishedWork（切换双缓冲）
  → Layout（useLayoutEffect 回调 ★、componentDidMount）
→ Commit 结束
→ 浏览器绘制（paint）
→ useEffect cleanup（上次的）+ useEffect 回调（本次的）★
```

**为什么 useLayoutEffect 在绘制前执行？**
> 因为它在 commit 的 Layout 子阶段中**同步**执行，而浏览器需要等 JS 执行结束后才能绘制。所以执行顺序是：`commitLayoutEffects → JS 空闲 → 浏览器绘制 → useEffect`。

### 踩坑点
- ❌ 不要说"useLayoutEffect 等同于 componentDidMount"——`componentDidMount` 在 Layout 阶段，但 class 组件和 function 组件的生命周期映射不是完全一致的
- ❌ 不要说"useEffect 是在 requestIdleCallback 中执行"——React 不用 rIC，用 Scheduler 调度

---

<a id="q16"></a>
## Q16. useEffect 的依赖对比是如何实现的？为什么用浅比较？

### 考察点
依赖追踪机制

### 回答 SOP

**实现**（`areHookInputsEqual`）：
```js
function areHookInputsEqual(nextDeps, prevDeps) {
  for (let i = 0; i < prevDeps.length && i < nextDeps.length; i++) {
    if (Object.is(nextDeps[i], prevDeps[i])) {
      continue;
    }
    return false;
  }
  return true;
}
```

> 逐个元素用 `Object.is` 比较（**浅比较**）。

**为什么用浅比较而不是深比较？**
> 1. **性能**：深比较需要递归遍历整个对象，O(n) 甚至 O(n²)，每次渲染都执行代价太高
> 2. **可预测性**：深比较的行为难以预测（循环引用、函数比较等），浅比较规则明确
> 3. **设计哲学**：React 鼓励**不可变数据**（immutable），新 state 应该是新引用：
>    ```jsx
>    // ✅ 正确：新对象，引用变化
>    setUser({ ...user, name: 'new' });
>    // ❌ 错误：修改原对象，引用不变，React 不感知变化
>    user.name = 'new'; setUser(user);
>    ```

**常见陷阱**：
```jsx
// ❌ 每次渲染 options 都是新对象，useEffect 每次都执行
useEffect(() => { fetch(url, options) }, [options]);

// ✅ 方案 1：拆开依赖
useEffect(() => { fetch(url, { method, headers }) }, [method, headers]);

// ✅ 方案 2：useMemo 稳定引用
const stableOptions = useMemo(() => ({ method, headers }), [method, headers]);
useEffect(() => { fetch(url, stableOptions) }, [stableOptions]);
```

---

<a id="q17"></a>
## Q17. useRef 为什么不会触发重新渲染？它在源码中是怎么实现的？

### 考察点
Hooks 实现差异

### 回答 SOP

**源码实现**：
```js
// Mount
function mountRef(initialValue) {
  const hook = mountWorkInProgressHook();
  const ref = { current: initialValue };
  hook.memoizedState = ref;
  return ref;  // 返回同一个对象引用
}

// Update
function updateRef(initialValue) {
  const hook = updateWorkInProgressHook();
  return hook.memoizedState;  // 直接返回，不做任何处理
}
```

**为什么不触发渲染**：
> 修改 `ref.current = newValue` 只是修改了一个普通 JS 对象的属性。这个操作：
> 1. 不调用任何 `dispatch/dispatchSetState`（无 Update 入队）
> 2. 不调用 `scheduleUpdateOnFiber`（无调度）
> 3. React 完全不知道变化发生了——因为 `ref` 对象本身的引用没变（`ref === ref`）

**useRef vs useState**：

| | `useRef` | `useState` |
|---|---|---|
| 修改方式 | `ref.current = value` | `setState(value)` |
| 触发渲染 | ❌ | ✅ |
| 同步读取最新值 | ✅（ref 始终是同一个对象） | ❌（state 是快照，闭包捕获的是渲染时的值）|
| 适用场景 | DOM 引用、缓存值、跨渲染周期通信 | UI 相关的状态 |

### 加分项
- 解释为什么 `ref.current` 在 `useEffect` 中也能读到最新值：因为是同一个对象引用，闭包捕获的是对象引用而不是值
- 提到 `useRef` 实际上是 `useMemo(() => ({ current: initialValue }), [])` 的特化版本

---

<a id="q18"></a>
## Q18. useMemo 和 useCallback 的实现原理？什么时候该用，什么时候不该用？

### 考察点
性能优化，过度优化意识

### 回答 SOP

**实现原理**：

```js
// useMemo mount
function mountMemo(nextCreate, deps) {
  const hook = mountWorkInProgressHook();
  const nextDeps = deps === undefined ? null : deps;
  const nextValue = nextCreate();  // 立即执行
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

// useMemo update
function updateMemo(nextCreate, deps) {
  const hook = updateWorkInProgressHook();
  const prevState = hook.memoizedState;
  const prevDeps = prevState[1];
  if (areHookInputsEqual(nextDeps, prevDeps)) {
    return prevState[0];  // deps 没变，返回缓存值
  }
  const nextValue = nextCreate();  // deps 变了，重新计算
  hook.memoizedState = [nextValue, nextDeps];
  return nextValue;
}

// useCallback 本质上是 useMemo 的特例
function mountCallback(callback, deps) {
  const hook = mountWorkInProgressHook();
  hook.memoizedState = [callback, deps];  // 直接缓存函数，不调用
  return callback;
}
// useCallback(fn, deps) ≡ useMemo(() => fn, deps)
```

**什么时候该用**：
> 1. ✅ 作为 props 传给被 `React.memo` 包裹的子组件时：避免子组件因引用变化重新渲染
> 2. ✅ 作为 `useEffect/useMemo/useCallback` 的依赖时：稳定引用避免无限循环
> 3. ✅ 计算量真的很大时（排序几万条数据等）

**什么时候不该用**：
> 1. ❌ 基本类型值：`useMemo(() => a + b, [a, b])` ——加法本身比 useMemo 的开销还小
> 2. ❌ 不传给子组件的内部函数：`const handleClick = useCallback(() => {...}, [])` ——如果 handleClick 只在当前组件用，包裹无意义
> 3. ❌ 没有配合 `React.memo` 使用：子组件不 memo，即使 props 引用稳定也会因父组件渲染而跟着渲染

### 踩坑点
- ❌ useMemo/useCallback 自身有开销（额外的 Hook 节点、deps 数组比较），不要"全包一层"
- ❌ 不要缓存每次都会变的 deps：`useMemo(() => fn(), [obj])` 如果 `obj` 每次渲染都是新引用，缓存完全无效

---

<a id="q19"></a>
## Q19. React.memo 的原理是什么？和 useMemo 有什么区别？

### 考察点
组件级 vs 值级缓存

### 回答 SOP

**React.memo 原理**：
> `React.memo(Component)` 返回一个包装组件，其 `fiber.tag = MemoComponent`。
> 在 `beginWork` 中处理 MemoComponent 时：
> ```
> 1. 比较新旧 props（默认用 shallowEqual，或用户自定义比较函数）
> 2. props 相同 + lanes 无更新 → bailout（跳过这个组件的 render）
> 3. props 不同 → 正常 render
> ```

**关键区别**：

| | `React.memo` | `useMemo` |
|---|---|---|
| 作用对象 | **组件**（跳过整个组件的 render） | **值**（缓存计算结果） |
| 位置 | 组件定义时包裹 | 组件函数内部调用 |
| 比较方式 | `shallowEqual`（所有 props 逐个比较） | `Object.is`（每个 dep 逐个比较） |
| 自定义比较 | ✅ `React.memo(Comp, areEqual)` | ❌ |

**配合使用的模式**：
```jsx
// 父组件
function Parent() {
  const [count, setCount] = useState(0);
  // ✅ 稳定引用：让 memo 子组件的 props 不变
  const handleClick = useCallback(() => console.log('click'), []);
  const data = useMemo(() => processData(rawData), [rawData]);

  return (
    <>
      <button onClick={() => setCount(c + 1)}>Count: {count}</button>
      <MemoChild onClick={handleClick} data={data} />
    </>
  );
}

// ✅ 只在 handleClick/data 变化时才 re-render
const MemoChild = React.memo(function Child({ onClick, data }) {
  return <div onClick={onClick}>{data.length}</div>;
});
```

---

<a id="q20"></a>
## Q20. React 怎么做性能优化？请从源码角度给出至少 5 个方案

### 考察点
综合性能优化能力

### 回答 SOP

按优先级排列：

**1. bailout 优化（最重要的内置优化）**
> `beginWork` 中如果 `oldProps === newProps && !hasContextChanged && workInProgress.lanes === NoLanes`
> → `bailoutOnAlreadyFinishedWork`：跳过当前组件 render
> → 进一步检查 `childLanes`：如果子树也无更新，跳过整棵子树
>
> **你能做的**：确保不变的 props 引用稳定（useMemo/useCallback）

**2. Eager State 跳过调度**
> `dispatchSetState` 中，如果 `fiber.lanes === NoLanes`（无待处理更新），提前计算新值并 `Object.is` 比较，相同则直接 return，连 `scheduleUpdateOnFiber` 都不调用。
>
> **你能做的**：避免 `setState(sameValue)`，尤其是在 useEffect 中

**3. subtreeFlags 子树跳过**
> `completeWork` 冒泡 flags → `commitMutationEffectsOnFiber` 中如果 `subtreeFlags === NoFlags`，跳过整个子树的 commit 遍历。
>
> **你能做的**：这是自动的，但组件拆分越细粒度，变化范围越小

**4. React.memo + useCallback/useMemo**
> 阻止 props 引用变化导致的不必要 re-render

**5. key 优化 Diff**
> 使用稳定且唯一的 key（如 item.id），让 Diff 算法准确复用节点，避免不必要的 DOM 操作

**6. useTransition / useDeferredValue**
> 将非紧急更新降级为 TransitionLane，不阻塞用户输入

**7. lazy + Suspense 代码分割**
> `React.lazy(() => import('./Heavy'))` 配合 `<Suspense>`，按需加载组件

**8. 列表虚拟化（非 React 内部，但面试常问）**
> 大列表只渲染可见区域的节点（react-window / react-virtualized），减少 Fiber 节点数量

### 完整优化清单

```
渲染前：
  └─ 代码分割（lazy/Suspense）  —— 减少首次加载
  └─ 稳定 key —— 减少 Diff 产生的 DOM 操作

渲染中（Render 阶段）：
  └─ bailout —— 跳过无变化组件/子树
  └─ React.memo —— 组件级 props 浅比较
  └─ useMemo/useCallback —— 稳定引用，配合 memo

调度层：
  └─ useTransition/useDeferredValue —— 降低非紧急更新优先级
  └─ Automatic Batching —— 合并多个 setState

提交后（Commit 阶段）：
  └─ subtreeFlags 跳过 —— 跳过无副作用子树
  └─ useEffect 异步 —— 不阻塞绘制
```
