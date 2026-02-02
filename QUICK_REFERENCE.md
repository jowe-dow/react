# 🚀 React 5分钟速学指南

**最快速度理解 React 的核心！为赶时间的你准备**

---

## 📖 React 是什么？

```
React = 用 JavaScript 构建用户界面的库

核心思想：
  ├─ 组件化：把 UI 拆成小块
  ├─ 声明式：描述要什么，不是怎么做
  └─ 虚拟 DOM：提高性能
```

---

## 🎯 3个必懂概念

### 1. 组件 = JavaScript 函数

```jsx
function Button() {
  return <button>点击我</button>;
}
```

就这么简单！组件就是返回 UI 的函数。

### 2. State = 会变化的数据

```jsx
const [count, setCount] = useState(0);  // 创建状态
<button onClick={() => setCount(count + 1)}>  // 更新状态
  点击次数：{count}
</button>
```

`count` 变化 → React 自动更新 UI

### 3. Props = 父传子的数据

```jsx
function Parent() {
  return <Child name="张三" />;  // 传递 props
}

function Child(props) {
  return <div>{props.name}</div>;  // 接收 props
}
```

Props 是只读的，不能修改！

---

## ⚡ 最常用的 3 个 Hook

### useState - 管理状态

```jsx
const [value, setValue] = useState(初始值);
setValue(新值);  // 更新状态
```

### useEffect - 处理副作用

```jsx
useEffect(() => {
  // 要执行的代码
}, [依赖]);  // 依赖变化时执行
```

### useContext - 跨组件传数据

```jsx
const value = useContext(MyContext);  // 读取共享数据
```

---

## 🎨 JSX 核心语法

```jsx
// 1. 变量用 {}
<div>{name}</div>

// 2. 属性
<div className="box" style={{ color: 'red' }}>

// 3. 条件渲染
{isLoggedIn && <p>已登录</p>}
{isLoggedIn ? <A /> : <B />}

// 4. 列表渲染
{items.map(item => <li key={item.id}>{item.name}</li>)}

// 5. 事件处理
<button onClick={handleClick}>点击</button>
```

---

## 💡 5个必记规则

### 1. 不能直接修改 state

```jsx
// ❌ 错误
state.value = 123;

// ✅ 正确
setState({ value: 123 });
```

### 2. onClick 不加括号

```jsx
// ❌ 错误（立即执行）
<button onClick={func()}>

// ✅ 正确（传递函数）
<button onClick={func}>
<button onClick={() => func(param)}>  // 需要传参时
```

### 3. 列表必须有 key

```jsx
// ✅ 正确
{items.map(item => <li key={item.id}>{item}</li>)}
```

### 4. Hooks 在顶层调用

```jsx
// ❌ 错误
if (condition) {
  const [state, setState] = useState();
}

// ✅ 正确
const [state, setState] = useState();
```

### 5. useEffect 依赖要写全

```jsx
useEffect(() => {
  console.log(count, name);  // 用了 count 和 name
}, [count, name]);  // 都要写在依赖数组里
```

---

## 🎯 React 数据流

```
父组件
  ↓ props（向下）
子组件
  ↓ 调用父组件函数（向上）
父组件更新 state
  ↓ 新 props（向下）
子组件重新渲染
```

**记住：** 数据只能从上往下流！

---

## 🔥 快速上手步骤

### 1. 创建项目（2分钟）

```bash
npm create vite@latest my-app -- --template react
cd my-app
npm install
npm run dev
```

### 2. 第一个组件（3分钟）

```jsx
// src/App.jsx
import { useState } from 'react';

function App() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <h1>计数器</h1>
      <p>当前计数：{count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <button onClick={() => setCount(count - 1)}>-1</button>
      <button onClick={() => setCount(0)}>重置</button>
    </div>
  );
}

export default App;
```

### 3. 运行看效果（1分钟）

打开浏览器，看到计数器 → 恭喜，你会 React 了！

---

## 📚 学习路线（4周计划）

```
第1周：基础
  ├─ 组件、JSX、Props、State
  └─ 做一个计数器

第2周：Hooks
  ├─ useState、useEffect、useContext
  └─ 做一个待办事项

第3周：进阶
  ├─ 表单处理、数据获取
  └─ 做一个用户列表

第4周：项目
  ├─ 综合应用所学
  └─ 做一个完整项目
```

---

## 🎓 必看文档推荐

### 超级新手（0基础）

1. **[可视化学习指南](./BEGINNER_VISUAL_GUIDE.md)** ← 从这里开始！
   - 用生活比喻解释概念
   - 秒懂 React 核心思想

2. **[代码逐行详解](./CODE_WALKTHROUGH.md)**
   - 每行代码都有注释
   - 看完就会写

### 遇到问题

3. **[FAQ 常见问题](./FAQ.md)**
   - 20+ 个初学者问题
   - 快速找到答案

4. **[概念对比表](./CONCEPT_COMPARISON.md)**
   - 对比容易混淆的概念
   - 一看就懂

### 深入学习

5. **[架构深度解析](./REACT_ARCHITECTURE_CN.md)**
   - 系统学习 React 原理
   - 理解 Fiber、Diff 算法

6. **[架构图解](./ARCHITECTURE_DIAGRAMS.md)**
   - 流程图、架构图
   - 可视化理解

---

## 💡 记忆口诀

```
组件返回 UI，
Props 父传子，
State 自己管，
变化会渲染。

Hooks 顶层调，
依赖要写全，
onClick 不加括号，
Key 必须唯一。

State 不直接改，
创建新对象，
map 遍历数组，
条件用三元。
```

---

## ⚠️ 5个新手常犯错误

```
❌ 1. 直接修改 state
    state.value = 123  // 错！

❌ 2. onClick 加括号
    onClick={func()}  // 错！

❌ 3. 忘记写 key
    {items.map(item => <li>{item}</li>)}  // 错！

❌ 4. Hooks 在条件语句
    if (x) { const [s, setS] = useState() }  // 错！

❌ 5. 忘记 useEffect 依赖
    useEffect(() => { use(count) }, [])  // 错！
```

---

## 🎯 现在就开始！

### 今天的任务（30分钟）

1. ✅ 看完这份5分钟指南（5分钟）
2. ✅ 创建第一个 React 项目（5分钟）
3. ✅ 写一个计数器组件（10分钟）
4. ✅ 阅读[可视化学习指南](./BEGINNER_VISUAL_GUIDE.md)第一课（10分钟）

### 本周目标

- 每天学习 1-2 小时
- 完成 3 个小项目
- 掌握基础概念

---

## 📞 需要帮助？

遇到问题？按顺序查找：

1. **[FAQ](./FAQ.md)** - 常见问题都在这里
2. **[可视化指南](./BEGINNER_VISUAL_GUIDE.md)** - 用比喻理解概念
3. **[代码详解](./CODE_WALKTHROUGH.md)** - 看具体代码怎么写
4. **[概念对比](./CONCEPT_COMPARISON.md)** - 快速对比查找

---

## 🎉 总结

React 的核心就这些：

```
┌─────────────────────────┐
│  组件 = 函数返回 UI      │
│  Props = 父传子数据      │
│  State = 会变的数据      │
│  Hooks = 函数组件功能    │
│  JSX = JS 里写 HTML      │
└─────────────────────────┘
```

**掌握这些，你就会用 React 了！**

接下来：
- 📖 深入学习 → 看完整文档
- 💻 动手实践 → 做项目
- 🤔 遇到问题 → 查 FAQ

---

**祝你学习愉快！React 其实很简单！** 💪🎉

**记住：不要怕，不要急，一步一步来！** ✨
