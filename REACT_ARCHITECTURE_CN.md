# React 架构深度解析（前端初学者指南）

## 目录
1. [React 简介](#react-简介)
2. [核心概念](#核心概念)
3. [整体架构](#整体架构)
4. [核心包详解](#核心包详解)
5. [Fiber 架构](#fiber-架构)
6. [渲染流程](#渲染流程)
7. [更新机制](#更新机制)
8. [调度器（Scheduler）](#调度器scheduler)
9. [协调器（Reconciler）](#协调器reconciler)
10. [渲染器（Renderer）](#渲染器renderer)
11. [学习路线建议](#学习路线建议)

---

## React 简介

React 是由 Facebook（现 Meta）开发的用于构建用户界面的 JavaScript 库。它的核心理念是：

- **声明式编程**：你只需要描述 UI 应该是什么样子，React 会负责更新 DOM
- **组件化**：将 UI 拆分成独立的、可复用的组件
- **一次学习，到处编写**：可以用 React 开发 Web、移动端（React Native）、VR 等多种平台的应用

### 为什么选择 React？

1. **虚拟 DOM**：提高性能，减少直接操作真实 DOM
2. **单向数据流**：数据流动清晰，易于调试
3. **丰富的生态系统**：大量的第三方库和工具
4. **强大的社区支持**：海量的学习资源和解决方案

---

## 核心概念

### 1. 组件（Component）

组件是 React 的基本构建块。可以理解为一个独立的、可复用的 UI 片段。

**函数组件示例：**
```jsx
function Welcome(props) {
  return <h1>你好，{props.name}</h1>;
}
```

**类组件示例：**
```jsx
class Welcome extends React.Component {
  render() {
    return <h1>你好，{this.props.name}</h1>;
  }
}
```

### 2. JSX

JSX 是 JavaScript 的语法扩展，允许你在 JavaScript 中编写类似 HTML 的代码。

```jsx
const element = <h1>Hello, world!</h1>;
```

实际上，JSX 会被编译成：
```javascript
const element = React.createElement('h1', null, 'Hello, world!');
```

### 3. 虚拟 DOM（Virtual DOM）

虚拟 DOM 是真实 DOM 的 JavaScript 对象表示。React 使用虚拟 DOM 来提高性能：

1. **创建虚拟 DOM**：当数据变化时，React 会创建新的虚拟 DOM 树
2. **Diff 算法**：比较新旧虚拟 DOM 树，找出差异
3. **更新真实 DOM**：只更新变化的部分到真实 DOM

**优势**：
- 减少直接操作 DOM 的次数
- 批量更新，提高性能
- 跨平台支持（React Native）

### 4. State（状态）和 Props（属性）

**Props（属性）**：
- 从父组件传递给子组件的数据
- 只读，不能修改
```jsx
<Welcome name="张三" />
```

**State（状态）**：
- 组件内部的数据
- 可以修改，通过 `setState` 或 `useState`
```jsx
const [count, setCount] = useState(0);
```

---

## 整体架构

React 的架构可以分为三层：

```
┌─────────────────────────────────────────┐
│           React Core (react)            │  核心层
│  (定义组件、Hooks、JSX 等核心 API)      │
├─────────────────────────────────────────┤
│     Reconciler (react-reconciler)       │  协调层
│   (Fiber 架构、Diff 算法、调度逻辑)     │
├─────────────────────────────────────────┤
│       Renderer (react-dom 等)           │  渲染层
│    (将虚拟 DOM 渲染到具体平台)          │
└─────────────────────────────────────────┘
```

### 三层职责

1. **React Core（核心层）**
   - 定义组件的创建方式（函数组件、类组件）
   - 提供 Hooks API（useState, useEffect 等）
   - 处理 JSX 转换

2. **Reconciler（协调层）**
   - Fiber 架构的核心实现
   - 执行 Diff 算法，找出需要更新的部分
   - 任务调度和优先级管理

3. **Renderer（渲染层）**
   - `react-dom`：渲染到浏览器 DOM
   - `react-native`：渲染到原生移动平台
   - `react-art`：渲染到 Canvas
   - 可以自定义渲染器，渲染到任何平台

---

## 核心包详解

React 源码仓库包含多个包，每个包负责不同的功能：

### 1. react

**位置**：`packages/react`

**职责**：React 的核心 API

**主要导出**：
- `Component`, `PureComponent`：类组件基类
- `createElement`：创建 React 元素（JSX 编译后调用）
- `useState`, `useEffect`, `useContext` 等 Hooks
- `memo`, `lazy`, `Suspense` 等高级 API

**示例代码**：
```javascript
import { useState, useEffect } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  useEffect(() => {
    document.title = `点击了 ${count} 次`;
  }, [count]);
  
  return (
    <button onClick={() => setCount(count + 1)}>
      点击次数：{count}
    </button>
  );
}
```

### 2. react-reconciler

**位置**：`packages/react-reconciler`

**职责**：React 的协调引擎，实现 Fiber 架构

**核心文件**：
- `ReactFiber.js`：Fiber 节点的定义
- `ReactFiberWorkLoop.js`：工作循环，处理更新
- `ReactFiberBeginWork.js`：开始处理 Fiber 节点
- `ReactFiberCompleteWork.js`：完成 Fiber 节点处理
- `ReactChildFiber.js`：处理子节点的 Diff

**关键功能**：
- 实现可中断的渲染
- 任务优先级管理
- Diff 算法
- 副作用收集

### 3. react-dom

**位置**：`packages/react-dom`

**职责**：React 的浏览器渲染器

**主要 API**：
- `createRoot`：创建根节点（React 18+）
- `render`：渲染应用（旧版 API）
- `hydrate`：服务端渲染水合
- `flushSync`：同步刷新更新

**示例**：
```javascript
import { createRoot } from 'react-dom/client';

const root = createRoot(document.getElementById('root'));
root.render(<App />);
```

### 4. scheduler

**位置**：`packages/scheduler`

**职责**：任务调度器，管理任务的执行优先级

**核心功能**：
- 时间切片（Time Slicing）
- 优先级调度
- 在浏览器空闲时执行任务
- 支持任务取消

**工作原理**：
```
高优先级任务 ──┐
中优先级任务 ──┼──→ Scheduler ──→ 按优先级执行
低优先级任务 ──┘
```

### 5. react-dom-bindings

**位置**：`packages/react-dom-bindings`

**职责**：DOM 相关的配置和操作

**功能**：
- DOM 节点的创建、更新、删除
- 事件系统
- DOM 属性处理

### 6. shared

**位置**：`packages/shared`

**职责**：各个包共享的工具函数和常量

**内容**：
- 常量定义
- 类型检查函数
- 通用工具函数

---

## Fiber 架构

Fiber 是 React 16 引入的新协调引擎，是 React 最核心的架构创新。

### 为什么需要 Fiber？

**React 15 的问题**：
- 采用递归方式更新组件
- 一旦开始更新，无法中断
- 大型应用更新时会导致页面卡顿

**Fiber 的解决方案**：
- 将渲染工作分解成小的任务单元
- 可以暂停、继续、终止任务
- 给不同任务分配优先级

### Fiber 是什么？

Fiber 可以理解为一种数据结构，每个 React 元素都对应一个 Fiber 节点。

**Fiber 节点结构**：
```javascript
{
  // 标识 Fiber 类型
  tag: WorkTag,                // 函数组件、类组件、原生标签等
  type: any,                   // 对应的组件类型
  
  // Fiber 关系
  return: Fiber | null,        // 父 Fiber
  child: Fiber | null,         // 第一个子 Fiber
  sibling: Fiber | null,       // 下一个兄弟 Fiber
  
  // 数据
  pendingProps: any,           // 新的 props
  memoizedProps: any,          // 上次渲染的 props
  memoizedState: any,          // 上次渲染的 state
  
  // 副作用
  flags: Flags,                // 标记需要执行的操作（更新、删除等）
  subtreeFlags: Flags,         // 子树的副作用标记
  
  // 调度
  lanes: Lanes,                // 优先级相关
  
  // 双缓存
  alternate: Fiber | null,     // 指向另一棵树中对应的 Fiber
}
```

### Fiber 树结构

React 维护两棵 Fiber 树：

1. **current 树**：当前屏幕显示的内容
2. **workInProgress 树**：正在构建的新树

```
      current 树                workInProgress 树
         App                         App
        /   \                       /   \
    Header  List    ⟷ alternate  Header  List
             / \                          / \
          Item Item                    Item Item
```

**双缓存机制**：
- 在内存中构建新树，构建完成后直接替换
- 类似于图形学中的双缓冲技术
- 避免用户看到不完整的 UI

### Fiber 工作流程

```
1. 开始更新
   ↓
2. 创建 workInProgress 树
   ↓
3. beginWork (递阶段)
   - 处理当前 Fiber
   - 创建子 Fiber
   - 标记副作用
   ↓
4. completeWork (归阶段)
   - 创建/更新 DOM 节点
   - 收集副作用链
   ↓
5. commit 阶段
   - 执行副作用
   - 更新真实 DOM
   - 调用生命周期
   ↓
6. 切换 current 树
```

---

## 渲染流程

React 的渲染分为两个阶段：

### 1. Render 阶段（可中断）

**目标**：构建 Fiber 树，找出需要更新的部分

**工作流程**：
```
beginWork
   ↓
遍历 Fiber 树 (深度优先)
   ↓
对比新旧节点 (Diff 算法)
   ↓
标记副作用 (flags)
   ↓
completeWork
```

**可以中断**：
- 使用浏览器的 `requestIdleCallback`（或 polyfill）
- 在空闲时间执行
- 高优先级任务可以打断低优先级任务

**关键代码**：
```javascript
// packages/react-reconciler/src/ReactFiberWorkLoop.js
function workLoopConcurrent() {
  // 可中断的工作循环
  while (workInProgress !== null && !shouldYield()) {
    performUnitOfWork(workInProgress);
  }
}
```

### 2. Commit 阶段（不可中断）

**目标**：将变化应用到真实 DOM

**三个子阶段**：

#### Before Mutation 阶段
- 执行 `getSnapshotBeforeUpdate`
- 异步调度 `useEffect`

#### Mutation 阶段
- 更新真实 DOM
- 执行 DOM 操作（增删改）

#### Layout 阶段
- 执行 `componentDidMount`/`componentDidUpdate`
- 执行 `useLayoutEffect`
- 更新 ref

**流程图**：
```
Commit 阶段
    ↓
Before Mutation
    ↓
Mutation (更新 DOM)
    ↓
Layout
    ↓
切换 current 指针
```

---

## 更新机制

### 触发更新的方式

1. **ReactDOM.render**（初次渲染）
2. **this.setState**（类组件）
3. **useState 的 set 函数**（函数组件）
4. **forceUpdate**（强制更新）

### Update 对象

每次更新会创建一个 Update 对象：

```javascript
{
  lane: Lane,           // 优先级
  tag: UpdateTag,       // 更新类型
  payload: any,         // 更新内容（setState 的参数）
  callback: Function,   // 回调函数
  next: Update | null,  // 下一个更新
}
```

### 更新队列

多个更新会形成一个链表：

```
Update1 → Update2 → Update3 → null
```

### 批量更新（Batching）

React 会自动合并多个 `setState` 调用：

```javascript
// React 17 及以下：只在事件处理函数中批量更新
handleClick() {
  this.setState({ count: 1 });  // 不会立即渲染
  this.setState({ count: 2 });  // 不会立即渲染
  this.setState({ count: 3 });  // 批量更新，只渲染一次
}

// React 18+：所有地方都会批量更新（包括 Promise、setTimeout 等）
setTimeout(() => {
  setCount(1);  // 不会立即渲染
  setCount(2);  // 批量更新，只渲染一次
}, 1000);
```

### 优先级

React 18 引入了优先级系统：

**优先级级别**：
1. **Immediate**：需要立即执行（如用户输入）
2. **UserBlocking**：用户交互（如点击按钮）
3. **Normal**：普通更新（如数据请求）
4. **Low**：低优先级（如分析上报）
5. **Idle**：空闲时执行（如预加载）

**示例**：
```javascript
// 高优先级更新
<input onChange={handleChange} />  // 用户输入，立即响应

// 低优先级更新
<List items={searchResults} />     // 搜索结果，可以延迟
```

---

## 调度器（Scheduler）

Scheduler 是 React 的任务调度中心，负责管理任务的执行时机和优先级。

### 核心概念

**时间切片（Time Slicing）**：
- 将长任务分解成多个小任务
- 每个小任务执行 5ms 左右
- 浏览器有时间处理其他工作（如渲染、用户输入）

**工作原理**：
```
任务开始
   ↓
执行 5ms
   ↓
检查是否需要让出控制权
   ↓
是 → 让出 → 等待下一帧 → 继续执行
   ↓
否 → 继续执行
```

### 任务队列

Scheduler 维护两个队列：

```javascript
// 待执行任务队列
const taskQueue = [];        // 已到执行时间的任务

// 延迟任务队列
const timerQueue = [];       // 还未到执行时间的任务
```

### 优先级调度

```javascript
// 任务优先级（从高到低）
ImmediatePriority      // 1  最高优先级，立即执行
UserBlockingPriority   // 2  用户交互，250ms 超时
NormalPriority         // 3  普通优先级，5s 超时
LowPriority            // 4  低优先级，10s 超时
IdlePriority           // 5  空闲时执行，永不超时
```

**示例**：
```javascript
// 用户输入 - 高优先级
scheduleCallback(UserBlockingPriority, () => {
  updateInputValue(value);
});

// 数据预加载 - 低优先级
scheduleCallback(IdlePriority, () => {
  preloadData();
});
```

---

## 协调器（Reconciler）

Reconciler 是 React 的核心，负责协调虚拟 DOM 和真实 DOM。

### Diff 算法

React 的 Diff 算法基于三个假设：

1. **不同类型的元素会产生不同的树**
   ```jsx
   // 直接销毁旧的 <div>，创建新的 <span>
   <div /> → <span />
   ```

2. **开发者可以通过 key 属性标识哪些元素是稳定的**
   ```jsx
   {items.map(item => <Item key={item.id} />)}
   ```

3. **同级元素之间才会进行比较**
   ```
   只比较同一层级：
   A        A
   ↓   VS   ↓
   B        C
   ```

### Diff 策略

#### 1. 单节点 Diff

**场景**：`<div /> → <div />`

```javascript
// 1. 判断 key 是否相同
if (oldFiber.key === newElement.key) {
  // 2. 判断 type 是否相同
  if (oldFiber.type === newElement.type) {
    // 复用节点，更新 props
    return useFiber(oldFiber, newElement.props);
  } else {
    // 删除旧节点，创建新节点
    return createFiber(newElement);
  }
} else {
  // 删除旧节点，创建新节点
  return createFiber(newElement);
}
```

#### 2. 多节点 Diff

**场景**：列表更新

**三种情况**：
1. **节点更新**：`<li key="a">1</li> → <li key="a">2</li>`
2. **节点新增/删除**：`[A, B, C] → [A, B, C, D]`
3. **节点移动**：`[A, B, C] → [C, A, B]`

**算法步骤**：

```javascript
// 第一轮遍历：处理更新
// 遍历新旧节点，如果可以复用就复用，不能复用就跳出循环

// 第二轮遍历：处理剩余节点
if (新节点遍历完了) {
  // 删除剩余的旧节点
  deleteRemainingChildren(oldFiber);
} else if (旧节点遍历完了) {
  // 创建剩余的新节点
  createChildren(newChildren);
} else {
  // 节点移动的情况
  // 1. 将剩余旧节点放入 Map（key → fiber）
  // 2. 遍历剩余新节点，从 Map 中查找可复用的节点
  // 3. 标记移动
}
```

**示例**：
```javascript
旧: A B C D
新: D A B C

第一轮：A 和 D 不匹配，跳出

第二轮：
  1. 将 A B C D 放入 Map
  2. 遍历 D A B C，从 Map 中查找
  3. 找到 D，标记移动
  4. 找到 A，标记移动
  ...
```

---

## 渲染器（Renderer）

Renderer 负责将 React 元素渲染到具体平台。

### ReactDOM（浏览器渲染器）

**核心 API**：
```javascript
import { createRoot } from 'react-dom/client';

// React 18 新 API
const root = createRoot(document.getElementById('root'));
root.render(<App />);

// 旧 API（不推荐）
ReactDOM.render(<App />, document.getElementById('root'));
```

**主要功能**：
1. **创建 DOM 节点**
   ```javascript
   createInstance(type, props) {
     const element = document.createElement(type);
     // 设置属性
     return element;
   }
   ```

2. **更新 DOM 属性**
   ```javascript
   commitUpdate(domElement, updatePayload, type, oldProps, newProps) {
     // 更新 DOM 属性
     updateDOMProperties(domElement, updatePayload);
   }
   ```

3. **处理事件**
   - 事件委托：所有事件绑定到根节点
   - 合成事件：跨浏览器的事件系统

### React Native（原生渲染器）

渲染到 iOS 和 Android 原生组件：

```javascript
import { View, Text } from 'react-native';

function App() {
  return (
    <View>
      <Text>Hello, React Native!</Text>
    </View>
  );
}
```

### 自定义渲染器

可以使用 `react-reconciler` 创建自定义渲染器：

```javascript
import Reconciler from 'react-reconciler';

const HostConfig = {
  createInstance(type, props) {
    // 创建你的平台节点
  },
  appendChild(parent, child) {
    // 添加子节点
  },
  // ... 其他方法
};

const CustomRenderer = Reconciler(HostConfig);
```

**应用场景**：
- 渲染到 Canvas
- 渲染到终端（Terminal）
- 渲染到 PDF
- 渲染到硬件设备

---

## 学习路线建议

### 第一阶段：基础入门（1-2 个月）

1. **学习 JavaScript 基础**
   - ES6+ 语法
   - 数组、对象操作
   - 函数、闭包、this
   - Promise、async/await

2. **学习 React 基础**
   - JSX 语法
   - 组件（函数组件、类组件）
   - Props 和 State
   - 事件处理
   - 条件渲染和列表渲染

3. **实践项目**
   - 待办事项应用
   - 简单博客
   - 天气应用

**推荐资源**：
- [React 官方文档](https://react.dev/)
- [React 中文文档](https://zh-hans.react.dev/)

### 第二阶段：进阶学习（2-3 个月）

1. **深入 Hooks**
   - useState, useEffect
   - useContext, useReducer
   - useMemo, useCallback
   - 自定义 Hooks

2. **状态管理**
   - Context API
   - Redux 或 Zustand
   - React Query（数据获取）

3. **路由**
   - React Router

4. **实践项目**
   - 电商网站
   - 社交媒体应用
   - 管理后台

### 第三阶段：深入原理（3-6 个月）

1. **理解 React 架构**
   - 虚拟 DOM 原理
   - Fiber 架构
   - Diff 算法
   - 调度机制

2. **阅读源码**
   - 从简单的函数开始（如 `createElement`）
   - 跟踪一次完整的渲染流程
   - 调试源码，理解细节

3. **性能优化**
   - React DevTools Profiler
   - 懒加载（React.lazy, Suspense）
   - 代码分割
   - 虚拟列表

4. **实践**
   - 造轮子（实现简易版 React）
   - 性能优化实战
   - 写技术博客分享

### 第四阶段：专家水平（持续学习）

1. **贡献开源**
   - 给 React 提 Issue
   - 修复 Bug
   - 提交 PR

2. **探索前沿**
   - React Server Components
   - Concurrent Features
   - Streaming SSR

3. **横向拓展**
   - TypeScript
   - 测试（Jest, React Testing Library）
   - 构建工具（Vite, Webpack）
   - 服务端渲染（Next.js）

---

## 核心数据流动图

```
用户交互 (onClick)
      ↓
触发更新 (setState)
      ↓
创建 Update 对象
      ↓
加入更新队列
      ↓
Scheduler 调度
      ↓
Reconciler 协调 (Fiber)
   ↓         ↓
Render     Diff
阶段       算法
   ↓         ↓
标记副作用   ↓
      ↓
Commit 阶段
      ↓
Renderer 渲染
      ↓
更新真实 DOM
      ↓
用户看到新 UI
```

---

## 常见面试题

### 1. React 的优势是什么？

**答案**：
- **虚拟 DOM**：提高性能，减少直接操作 DOM
- **组件化**：代码复用，易于维护
- **单向数据流**：数据流动清晰，易于调试
- **丰富生态**：大量第三方库和工具
- **跨平台**：React Native、React VR 等

### 2. 虚拟 DOM 的工作原理？

**答案**：
1. 状态变化时，创建新的虚拟 DOM 树
2. 使用 Diff 算法比较新旧虚拟 DOM
3. 找出需要更新的部分
4. 批量更新到真实 DOM

### 3. Fiber 是什么？解决了什么问题？

**答案**：
- Fiber 是 React 16 引入的新协调引擎
- **解决的问题**：
  - React 15 的递归更新无法中断，大型应用会卡顿
  - Fiber 可以中断、继续、终止任务
  - 支持优先级调度
  - 提高用户体验

### 4. React 的 Diff 算法？

**答案**：
- **树的比较**：只比较同层级节点
- **组件比较**：类型不同直接替换
- **元素比较**：通过 key 识别节点
- **时间复杂度**：O(n)（传统算法是 O(n³)）

### 5. setState 是同步还是异步？

**答案**：
- **React 18 之前**：
  - 在事件处理函数中是异步的（批量更新）
  - 在 setTimeout、Promise 中是同步的
- **React 18+**：
  - 所有地方都是异步的（自动批量更新）
  - 可以使用 `flushSync` 强制同步

### 6. React Hooks 的原理？

**答案**：
- Hooks 基于 Fiber 节点
- 每个 Fiber 有一个 `memoizedState` 链表
- 每个 Hook 对应链表中的一个节点
- 调用顺序必须一致（不能在条件语句中使用）

---

## 总结

React 的架构设计精妙，体现了现代前端框架的最佳实践：

1. **分层架构**：核心层、协调层、渲染层职责清晰
2. **Fiber 架构**：可中断、可恢复、支持优先级
3. **虚拟 DOM**：提高性能，实现跨平台
4. **Hooks**：让函数组件拥有状态和生命周期
5. **并发特性**：React 18 的新特性，提升用户体验

**学习建议**：
- 先学会使用，再深入原理
- 多写代码，多实践
- 阅读官方文档和源码
- 关注社区动态
- 持续学习，保持好奇心

**记住**：学习 React 是一个循序渐进的过程，不要急于求成。先掌握基础，再逐步深入，最终你会对 React 有全面深刻的理解。

---

## 参考资源

- [React 官方文档](https://react.dev/)
- [React 中文文档](https://zh-hans.react.dev/)
- [React 源码仓库](https://github.com/facebook/react)
- [React 技术揭秘](https://react.iamkasong.com/)
- [图解 React 原理系列](https://7km.top/)

---

**祝你学习愉快！如果有任何问题，欢迎随时交流。** 🚀
