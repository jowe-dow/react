# React 源码面试题 — 第三部分：Diff 算法 & Concurrent Mode & 综合题

> 每题提供：**题目 → 考察点 → 回答 SOP → 标准答案 → 加分项 → 踩坑点**

---

## 目录

- [Q21. React Diff 算法的核心思路是什么？时间复杂度是多少？](#q21)
- [Q22. 单节点 Diff 的流程是怎样的？key 和 type 分别怎么判断？](#q22)
- [Q23. 多节点 Diff 的两轮遍历是怎么工作的？](#q23)
- [Q24. 为什么 key 不能用 index？从源码角度解释](#q24)
- [Q25. React Diff 和 Vue 3 Diff 有什么区别？各自优劣？](#q25)
- [Q26. Concurrent Mode 是什么？解决了什么问题？](#q26)
- [Q27. useTransition 和 useDeferredValue 的区别和使用场景？](#q27)
- [Q28. Suspense 的实现原理是什么？throw Promise 是怎么工作的？](#q28)
- [Q29. React 事件系统（合成事件）是怎么工作的？](#q29)
- [Q30. React 18 vs React 19 有哪些架构级别的变化？](#q30)

---

<a id="q21"></a>
## Q21. React Diff 算法的核心思路是什么？时间复杂度是多少？

### 考察点
算法设计能力

### 回答 SOP

**第一步：三个假设**
> 传统树 Diff 是 O(n³)，React 基于三个假设降到 O(n)：
> 1. **不同类型产生不同树**：`<div>` 变 `<span>` → 直接销毁重建
> 2. **同层比较**：不跨层级移动节点
> 3. **key 唯一标识**：相同 key 的节点可以复用

**第二步：三种情况**
> Diff 入口在 `reconcileChildFibersImpl`（ReactChildFiber.js L1849），根据新 children 类型分发：
> - **单个元素** → `reconcileSingleElement`：遍历旧子节点，key+type 都匹配则复用
> - **数组** → `reconcileChildrenArray`：两轮遍历（见 Q23）
> - **文本** → `reconcileSingleTextNode`
> - **null/undefined** → 删除所有旧子节点

**第三步：复杂度分析**
> - 单节点：O(n)（遍历旧兄弟节点找 key 匹配）
> - 多节点第一轮：O(n)（顺序比较）
> - 多节点第二轮：O(n)（Map 查找 + 遍历，Map 操作 O(1)）
> - 总计：O(n)

### 加分项
- 提到 React 的 Diff 是**单向从左到右**扫描，不用双指针（Vue 用头尾双指针）
- 解释为什么不追求最优：实际场景中**更新多于移动**，简单算法反而更快

---

<a id="q22"></a>
## Q22. 单节点 Diff 的流程是怎样的？key 和 type 分别怎么判断？

### 考察点
Diff 细节

### 回答 SOP

```
单节点 Diff（reconcileSingleElement）：
遍历所有旧子节点：
  ┌─ key 相同?
  │   ├─ type 也相同 → ✅ 复用！删除多余兄弟，clone 返回
  │   └─ type 不同   → ❌ 删除所有旧子节点（包括当前），创建新节点
  │                     为什么全删？因为 key 唯一，key 匹配但 type 不同
  │                     说明这个位置的组件完全变了
  └─ key 不同 → 删除当前旧子节点，继续遍历下一个兄弟

没有匹配 → 创建新 Fiber
```

**为什么 key 相同 + type 不同要"删除所有"而不是"继续找"？**
> 因为 key 是唯一的。如果 key 匹配了但 type 不同，说明该位置的组件已经被替换。旧树中不可能有另一个相同 key 的节点，所以直接删除所有旧节点，创建新的。

**示例**：
```jsx
// 旧：<div key="a"><span key="b" /><p key="c" /></div>
// 新：<div key="a"><section key="b" /></div>

// key="b" 匹配，但 span → section（type 不同）
// → 删除 span 和 p（所有旧子节点）
// → 创建新的 section
```

---

<a id="q23"></a>
## Q23. 多节点 Diff 的两轮遍历是怎么工作的？

### 考察点
核心算法（高频、必考、必须能画图解释）

### 回答 SOP

**设计思路**：两轮遍历，因为**实际场景中更新 >> 移动/新增/删除**。

**第一轮：处理从左到右连续相同的节点**
```
旧：A  B  C  D
新：A  B  E  F

比较 A↔A → key/type 相同 → 复用，继续
比较 B↔B → key/type 相同 → 复用，继续
比较 C↔E → key 不同 → 退出第一轮！
```

**第一轮结束后三种情况**：

```
情况 1. 新节点遍历完，旧节点有剩余
  旧：A B C D    新：A B
  第一轮完成 A B 复用，然后新节点结束
  → deleteRemainingChildren(C, D)  删除多余旧节点

情况 2. 旧节点遍历完，新节点有剩余
  旧：A B        新：A B C D
  第一轮完成 A B 复用，然后旧节点结束
  → 创建 C、D（标记 Placement）

情况 3. 新旧都有剩余（需要第二轮遍历）
  旧：A B C D    新：A C D B
  第一轮 A↔A 复用，B↔C key 不同退出
  → 进入第二轮
```

**第二轮：用 Map 处理乱序**
```
剩余旧节点建 Map：{B.key: FiberB, C.key: FiberC, D.key: FiberD}

遍历剩余新节点：
  C → Map 中找到 FiberC → 复用，从 Map 删除
  D → Map 中找到 FiberD → 复用，从 Map 删除
  B → Map 中找到 FiberB → 复用，从 Map 删除

Map 中剩余节点 → 全部标记删除
```

**lastPlacedIndex 判断移动**：
```
核心规则：记录上一个"原位不动"节点的旧索引。
新节点对应的 oldIndex < lastPlacedIndex → 需要移动（Placement）
新节点对应的 oldIndex >= lastPlacedIndex → 不动，更新 lastPlacedIndex

示例：旧 ABCD → 新 ACDB
  A: oldIndex=0, lastPlacedIndex=0 → 0>=0 不动, lastPlacedIndex=0
  C: oldIndex=2, lastPlacedIndex=0 → 2>=0 不动, lastPlacedIndex=2
  D: oldIndex=3, lastPlacedIndex=2 → 3>=2 不动, lastPlacedIndex=3
  B: oldIndex=1, lastPlacedIndex=3 → 1<3 需要移动！标记 Placement

结果：只移动 B（1 次 DOM 操作）
```

### 加分项
- 能手画"ABCD → DABC"这个 React 弱点场景：D 不动，ABC 全部需要移动（3 次），但 Vue 3 用 LIS 只需要移动 D（1 次）
- 解释为什么第一轮和第二轮分开：因为第一轮处理的是最常见的"顺序更新"场景，O(n) 无额外空间；Map 只在需要时创建

---

<a id="q24"></a>
## Q24. 为什么 key 不能用 index？从源码角度解释

### 考察点
key 的实际影响

### 回答 SOP

**问题场景**：
```jsx
// 列表 [A, B, C]，在头部插入 D → [D, A, B, C]
// 用 index 作为 key：
// 旧：key=0(A), key=1(B), key=2(C)
// 新：key=0(D), key=1(A), key=2(B), key=3(C)

// Diff 结果（按 key 匹配）：
// key=0: A→D（type 可能相同但内容不同 → Update 而不是复用！）
// key=1: B→A（Update）
// key=2: C→B（Update）
// key=3: 无旧节点（Placement 新增 C）

// 结果：3 次 Update + 1 次 Placement = 4 次 DOM 操作 ❌
```

```jsx
// 用 item.id 作为 key：
// 旧：key=a(A), key=b(B), key=c(C)
// 新：key=d(D), key=a(A), key=b(B), key=c(C)

// Diff 结果：
// key=d: 无旧节点 → Placement（插入 D）
// key=a: 匹配旧 A → 复用（不动或移动）
// key=b: 匹配旧 B → 复用
// key=c: 匹配旧 C → 复用

// 结果：1 次 Placement = 1 次 DOM 操作 ✅
```

**更严重的问题——状态错乱**：
```jsx
// 每项有 <input> 带自身 state
[A(input="hello"), B(input="world")]

// 删除 A → [B(input="world")]
// 用 index 作 key：
// 旧 key=0(A) vs 新 key=0(B) → key 相同！React 复用 key=0 的 Fiber
// → B 继承了 A 的 state → input 显示 "hello" 而不是 "world" ❌
```

### 踩坑点
- ❌ "不用 index 做 key 是因为性能" —— 更重要的原因是**状态错乱**
- ❌ "用 Math.random() 做 key" —— 每次渲染都不同，永远创建新节点，性能最差

---

<a id="q25"></a>
## Q25. React Diff 和 Vue 3 Diff 有什么区别？各自优劣？

### 考察点
框架对比能力、算法深度

### 回答 SOP

| 维度 | React | Vue 3 |
|------|-------|-------|
| **遍历方向** | 单向（从左到右） | 双向（头尾双指针预处理） |
| **核心算法** | `lastPlacedIndex`（贪心） | 最长递增子序列 LIS |
| **时间复杂度** | O(n) | O(n log n)（LIS 部分） |
| **空间复杂度** | O(n)（Map） | O(n)（Map + LIS 数组） |
| **最劣情况** | 首→尾移动：n-1 次 DOM 操作 | 首→尾移动：1 次 DOM 操作 |
| **实现复杂度** | 简单（~200行） | 较复杂（~400行）|

**具体差异（ABCD → DABC）**：

```
React（lastPlacedIndex）：
  D: oldIndex=3, lastPlacedIndex=0 → 不动, lastPlacedIndex=3
  A: oldIndex=0, 0<3 → 移动!
  B: oldIndex=1, 1<3 → 移动!
  C: oldIndex=2, 2<3 → 移动!
  → 3 次 DOM 操作 ❌

Vue 3（头尾双指针 + LIS）：
  头头比较：D vs A → 不匹配
  尾尾比较：D vs C → 不匹配（旧尾 D vs 新尾 C）
  头尾比较：A vs C → 不匹配
  尾头比较：D vs D → 匹配！移动 D 到头部
  → 1 次 DOM 操作 ✅
  （剩余 ABC 顺序未变，LIS = [A,B,C]，无需移动）
```

**React 为什么不用 LIS？**
> 1. 哲学差异：React 追求"足够好"而非"最优"，简单实现更易维护
> 2. 大多数场景（局部更新、列表尾部增删）两者性能相当
> 3. 首→尾移动在真实应用中很少见

### 加分项
- 能写出 LIS 的核心思路：找到旧索引序列中的最长递增子序列，这些节点不需要移动，只移动其余节点
- 提到 SolidJS 不需要 Diff：因为它的细粒度响应式系统直接定位到变化的 DOM 节点

---

<a id="q26"></a>
## Q26. Concurrent Mode 是什么？解决了什么问题？

### 考察点
React 18 核心特性

### 回答 SOP

**本质**：让 React 渲染变得**可中断**，高优先级更新可以随时插队。

**解决的核心问题**：
> 大型应用中，一次渲染可能需要 100ms+（如渲染 10000 个列表项）。
> - 传统模式：主线程被占用 100ms，期间用户输入（点击/打字）无法响应
> - 并发模式：每 5ms 让出主线程，若有用户输入则中断当前渲染，先处理输入

**关键机制**：
```
1. workLoopConcurrentByScheduler：每处理一个 Fiber 检查 shouldYield()
2. Lane 优先级：SyncLane(用户输入) > TransitionLane(数据加载)
3. 优先级抢占：高优先级进入时中断低优先级渲染
4. 双缓冲：被中断的 workInProgress 可以安全丢弃
```

**注意**：
> - `createRoot()` 才启用并发模式，`render()` 仍然是同步模式
> - 不是所有更新都可中断：`SyncLane` 走 `workLoopSync`（不可中断）
> - 并发模式不是"更快"，而是"更响应"——单次渲染可能更慢（调度开销）

### 加分项
- 提到"tearing"问题：并发渲染中组件可能在不同时刻读取不同版本的外部数据，`useSyncExternalStore` 就是为解决此问题
- 提到 React 内部通过"版本"（Lane）来判断数据一致性

---

<a id="q27"></a>
## Q27. useTransition 和 useDeferredValue 的区别和使用场景？

### 考察点
并发 API 理解

### 回答 SOP

| | `useTransition` | `useDeferredValue` |
|---|---|---|
| **控制对象** | 控制**触发动作**（setState） | 控制**消费值** |
| **返回值** | `[isPending, startTransition]` | 延迟后的值 |
| **优先级** | 包裹在 startTransition 内的 setState → TransitionLane | 内部安排一次 Transition 渲染 |
| **isPending** | ✅ 提供加载状态 | ❌ 不提供 |

**useTransition 场景**：你能控制 setState 的调用
```jsx
const [isPending, startTransition] = useTransition();
function handleClick() {
  startTransition(() => {
    setSearchResults(computeResults(query));  // 低优先级
  });
}
// isPending → 显示加载状态
```

**useDeferredValue 场景**：你不能控制值的来源（如 props）
```jsx
function SearchResults({ query }) {
  // query 来自 props，你无法控制父组件的 setState
  const deferredQuery = useDeferredValue(query);
  // deferredQuery 会"延迟"更新：先用旧值渲染（快速），再用新值渲染（后台）
  const results = computeResults(deferredQuery);
  return <List data={results} />;
}
```

**内部行为等价**：
```jsx
// useDeferredValue(value) 大致等价于：
const [deferred, setDeferred] = useState(value);
useEffect(() => {
  startTransition(() => setDeferred(value));
}, [value]);
```

### 加分项
- 提到 `startTransition`（非 Hook 版本，从 `react` 导入）没有 `isPending`，适合在非组件代码中使用
- 提到 Transition 渲染中 Suspense 不会立即 fallback，而是保持旧内容——实现"无闪烁"页面切换

---

<a id="q28"></a>
## Q28. Suspense 的实现原理是什么？throw Promise 是怎么工作的？

### 考察点
异步渲染机制

### 回答 SOP

**核心机制**：
> 1. 组件 render 时 `throw` 一个 **Promise**（不是 Error）
> 2. React 在 `renderRootConcurrent` 中 catch 到这个 thenable
> 3. 向上找最近的 `<Suspense>` 边界（`SuspenseComponent` Fiber）
> 4. 标记 `flags |= DidCapture`，进入 fallback 分支渲染
> 5. 给 Promise 注册 `.then()` 回调：resolve 后触发 `RetryLane` 重新调度
> 6. 重新渲染时数据已可用，正常 render，移除 fallback

```
组件树：
<Suspense fallback={<Spinner />}>
  <DataComponent />   ← throw Promise

第一次 render：
  beginWork(DataComponent) → throw thenable
  → catch → 找到 Suspense 边界
  → Suspense.flags |= DidCapture
  → 渲染 fallback (<Spinner />)
  → thenable.then(() => scheduleUpdateOnFiber(RetryLane))

Promise resolve 后：
  scheduleUpdateOnFiber(RetryLane)
  → beginWork(DataComponent) → 数据可用，正常返回
  → Suspense 移除 fallback，显示真正内容
```

**与 Error Boundary 的区别**：
> - Suspense 捕获的是 **Promise（thenable）**，用于异步等待
> - Error Boundary 捕获的是 **Error**，用于错误恢复
> - 判断：`catch(thrownValue) → typeof thrownValue.then === 'function' ? Suspense : ErrorBoundary`

### 加分项
- 提到 React.lazy 内部就是 throw Promise：首次 render 时 throw import() 返回的 Promise，加载完成后正常 render 模块的 default export
- 提到 Suspense + startTransition：在 Transition 上下文中触发的 Suspense 不会立即显示 fallback，而是保持旧 UI，避免闪烁

---

<a id="q29"></a>
## Q29. React 事件系统（合成事件）是怎么工作的？

### 考察点
事件委托、跨浏览器兼容

### 回答 SOP

**核心设计**：React 不在每个 DOM 节点上绑定事件，而是用**事件委托**到根容器（`rootContainer`）。

```
1. createRoot 时：在 root DOM 节点上注册所有支持的事件监听器
   root.addEventListener('click', dispatchEvent, false)
   root.addEventListener('change', dispatchEvent, false)
   // ... 所有事件

2. 事件触发时：
   浏览器冒泡到 root → dispatchEvent(nativeEvent)
   → 从 nativeEvent.target 获取对应的 Fiber 节点
   → 从 Fiber 向上遍历收集所有 onClick 处理器（模拟冒泡）
   → 创建 SyntheticEvent（合成事件）
   → 按冒泡/捕获顺序依次调用处理器

3. SyntheticEvent：
   - 跨浏览器统一接口（标准化 event 对象）
   - 事件池（React 17 之前复用，18+ 已移除）
   - e.stopPropagation() 只阻止 React 的合成冒泡
   - e.nativeEvent 可以访问原生事件
```

**为什么要事件委托？**
> 1. **内存**：10000 个列表项只需 1 个事件监听器（在 root 上），而不是 10000 个
> 2. **动态绑定**：新增/删除 DOM 节点不需要重新绑定事件
> 3. **优先级集成**：React 可以根据事件类型分配 Lane（click → SyncLane，scroll → InputContinuousLane）

**React 17+ 的变化**：
> 事件委托从 `document` 改到 `rootContainer`，支持多个 React 实例共存（微前端场景）

### 踩坑点
- ❌ `e.stopPropagation()` 不会阻止原生事件冒泡到 root（因为 React 是在 root 上监听的）
- ❌ 在 `useEffect` 中用 `document.addEventListener` 注册的事件，执行时机可能在 React 合成事件之前
- ✅ 如果需要真正阻止原生冒泡，用 `e.nativeEvent.stopImmediatePropagation()`

---

<a id="q30"></a>
## Q30. React 18 vs React 19 有哪些架构级别的变化？

### 考察点
前沿技术追踪

### 回答 SOP

**React 18 的核心变化**：
> 1. **Concurrent Mode 正式发布**：`createRoot` 替代 `render`
> 2. **Automatic Batching**：所有地方的 setState 自动批处理
> 3. **useTransition / useDeferredValue**：并发 API
> 4. **Suspense on server**：Streaming SSR（超出本文 CSR 范围）
> 5. **useSyncExternalStore**：解决并发渲染下的 tearing 问题

**React 19 的核心变化**：
> 1. **React Compiler**（原 React Forget）：自动在编译时插入 useMemo/useCallback，开发者无需手动优化
> 2. **Actions**：`useActionState`（替代 useFormState）、`useOptimistic`
> 3. **use() Hook**：可以在组件中直接 `use(promise)` 或 `use(context)`，无需 useContext
> 4. **ref 作为 prop**：函数组件可以直接接收 ref 参数，不再需要 forwardRef
> 5. **Document Metadata**：组件中直接写 `<title>`、`<meta>` 等会自动提升到 `<head>`
> 6. **Asset Loading**：`preload()`、`preinit()` 等资源预加载 API

**React Compiler 为什么重要？**
> 它在**编译时**分析组件代码，自动在需要的地方插入缓存：
> ```jsx
> // 你写的代码
> function Component({ data }) {
>   const sorted = data.sort((a, b) => a - b);
>   return <List items={sorted} />;
> }
>
> // 编译后（React Compiler 自动优化）
> function Component({ data }) {
>   const sorted = useMemo(() => data.sort(...), [data]);
>   return <List items={sorted} />;
> }
> ```
> 这解决了 React 最大的 DX 痛点：手动 memo 的心智负担。

---

## 附录：面试回答通用 SOP

### 1. 分层回答法（推荐）

```
第一层（30秒）：一句话说明"是什么"+ 核心作用
第二层（2分钟）：展开"为什么"+ 2-3 个关键点
第三层（5分钟）：源码位置 + 代码片段 + 边界情况

根据面试官反应决定展开到哪一层！
```

### 2. 对比法

```
"X 和 Y 有什么区别？"
→ 先画表格（维度：定义、作用对象、实现方式、执行时机、使用场景）
→ 再给一个具体的代码示例
→ 最后一句话总结："一句话说就是 X 用于...，Y 用于..."
```

### 3. 全链路法（一次 setState 的完整流程这类题）

```
用编号列出每个关键步骤 + 对应的源码文件名：
① 触发 → ② 创建 Update → ③ 入队 → ④ 调度 → ⑤ Render → ⑥ Commit → ⑦ 绘制

面试官追问时可以在任一步骤展开
```

### 4. 场景反问法

```
面试官："React 怎么做性能优化？"
你："可以从渲染前、渲染中、调度层三个维度展开，您更希望我重点聊哪个方向？"
→ 展示结构化思维 + 主动掌握节奏
```

### 5. 回答禁忌

```
❌ 背诵博客原文（一听就知道是背的）
❌ 只说概念不给例子
❌ 把所有东西塞进一个回答（选择性展开！）
❌ 对不确定的知识编造答案（"这个我了解大概原理但具体细节不太确定"更好）
❌ 只说 API 怎么用，不说为什么这么设计
```
