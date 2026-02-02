# React 概念对比速查表 📊

**快速查找和对比 React 中容易混淆的概念**

---

## 📋 目录

1. [Props vs State](#1-props-vs-state)
2. [函数组件 vs 类组件](#2-函数组件-vs-类组件)
3. [受控组件 vs 非受控组件](#3-受控组件-vs-非受控组件)
4. [useState vs useReducer](#4-usestate-vs-usereducer)
5. [useEffect vs useLayoutEffect](#5-useeffect-vs-uselayouteffect)
6. [useMemo vs useCallback](#6-usememo-vs-usecallback)
7. [createElement vs JSX](#7-createelement-vs-jsx)
8. [事件对比：合成事件 vs 原生事件](#8-合成事件-vs-原生事件)
9. [key 的作用](#9-key-的作用)
10. [常见 Hooks 对比](#10-常见-hooks-对比)

---

## 1. Props vs State

### 对比表

| 特性 | Props（属性） | State（状态） |
|------|------------|-------------|
| **定义** | 从父组件传入 | 组件内部数据 |
| **可修改性** | ❌ 只读，不能修改 | ✅ 可以修改 |
| **修改方式** | - | `setState` 或 `setXxx` |
| **数据来源** | 父组件 | 组件自己 |
| **用途** | 配置组件 | 管理动态数据 |
| **触发渲染** | ✅ props 变化触发 | ✅ state 变化触发 |

### 代码示例

```jsx
// ========== Props ==========
function Child(props) {
  // ❌ 错误：不能修改 props
  // props.name = "新名字";  // 错误！
  
  // ✅ 正确：只能读取 props
  return <div>{props.name}</div>;
}

function Parent() {
  return <Child name="张三" />;  // 传递 props
}

// ========== State ==========
function Counter() {
  // ✅ 可以修改 state
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>
        增加
      </button>
    </div>
  );
}
```

### 记忆技巧

```
Props = 父母给的零花钱
  └─ 你不能改变给你多少钱
  └─ 只能用，不能改

State = 你自己的存款
  └─ 你可以自己决定存多少
  └─ 可以随时增加或减少
```

---

## 2. 函数组件 vs 类组件

### 对比表

| 特性 | 函数组件 | 类组件 |
|------|---------|--------|
| **语法** | 函数 | 类 |
| **状态管理** | Hooks (useState) | this.state |
| **生命周期** | useEffect | componentDidMount 等 |
| **this 绑定** | ✅ 无需考虑 | ⚠️ 需要绑定 this |
| **代码量** | ✅ 简洁 | ⚠️ 较多 |
| **推荐程度** | 🔥 强烈推荐 | ⚠️ 不推荐（旧写法） |

### 代码对比

```jsx
// ========== 函数组件（推荐） ==========
import { useState } from 'react';

function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
    </div>
  );
}

// ========== 类组件（不推荐） ==========
import React from 'react';

class Counter extends React.Component {
  constructor(props) {
    super(props);
    this.state = { count: 0 };
    // 需要绑定 this
    this.handleClick = this.handleClick.bind(this);
  }
  
  handleClick() {
    this.setState({ count: this.state.count + 1 });
  }
  
  render() {
    return (
      <div>
        <p>{this.state.count}</p>
        <button onClick={this.handleClick}>+1</button>
      </div>
    );
  }
}
```

### 选择建议

```
✅ 新项目：使用函数组件 + Hooks
✅ 旧项目：逐步迁移到函数组件
❌ 不推荐：新代码使用类组件
```

---

## 3. 受控组件 vs 非受控组件

### 对比表

| 特性 | 受控组件 | 非受控组件 |
|------|---------|-----------|
| **值的来源** | React state | DOM 自己 |
| **获取值** | 直接读取 state | 需要 ref |
| **实时验证** | ✅ 容易 | ❌ 困难 |
| **推荐程度** | 🔥 推荐 | ⚠️ 特殊场景 |

### 代码对比

```jsx
// ========== 受控组件（推荐） ==========
function ControlledForm() {
  const [value, setValue] = useState('');
  
  return (
    <input
      value={value}                          // 值由 state 控制
      onChange={(e) => setValue(e.target.value)}  // 更新 state
    />
  );
}

// ========== 非受控组件 ==========
import { useRef } from 'react';

function UncontrolledForm() {
  const inputRef = useRef();
  
  function handleSubmit() {
    console.log(inputRef.current.value);  // 需要用 ref 获取
  }
  
  return (
    <div>
      <input ref={inputRef} />             // 值由 DOM 控制
      <button onClick={handleSubmit}>提交</button>
    </div>
  );
}
```

### 选择建议

```
✅ 大多数情况：使用受控组件
  └─ 需要实时验证
  └─ 需要根据输入动态改变 UI
  └─ 多个输入框相互依赖

⚠️ 特殊情况：使用非受控组件
  └─ 文件上传
  └─ 与第三方库集成
  └─ 性能优化（避免频繁渲染）
```

---

## 4. useState vs useReducer

### 对比表

| 特性 | useState | useReducer |
|------|----------|-----------|
| **适用场景** | 简单状态 | 复杂状态 |
| **状态更新** | 直接设置 | dispatch action |
| **逻辑集中** | 分散在组件中 | 集中在 reducer |
| **类型安全** | 较弱 | 较强 |
| **学习曲线** | ✅ 简单 | ⚠️ 需要学习 |

### 代码对比

```jsx
// ========== useState ==========
function Counter() {
  const [count, setCount] = useState(0);
  
  return (
    <div>
      <p>{count}</p>
      <button onClick={() => setCount(count + 1)}>+</button>
      <button onClick={() => setCount(count - 1)}>-</button>
      <button onClick={() => setCount(0)}>重置</button>
    </div>
  );
}

// ========== useReducer ==========
function reducer(state, action) {
  switch (action.type) {
    case 'increment':
      return { count: state.count + 1 };
    case 'decrement':
      return { count: state.count - 1 };
    case 'reset':
      return { count: 0 };
    default:
      return state;
  }
}

function Counter() {
  const [state, dispatch] = useReducer(reducer, { count: 0 });
  
  return (
    <div>
      <p>{state.count}</p>
      <button onClick={() => dispatch({ type: 'increment' })}>+</button>
      <button onClick={() => dispatch({ type: 'decrement' })}>-</button>
      <button onClick={() => dispatch({ type: 'reset' })}>重置</button>
    </div>
  );
}
```

### 选择建议

```
✅ 使用 useState 当：
  └─ 状态简单（一个值）
  └─ 更新逻辑简单
  └─ 状态之间无关联

✅ 使用 useReducer 当：
  └─ 状态复杂（多个相关值）
  └─ 更新逻辑复杂
  └─ 需要状态历史
  └─ 需要撤销/重做
```

---

## 5. useEffect vs useLayoutEffect

### 对比表

| 特性 | useEffect | useLayoutEffect |
|------|----------|----------------|
| **执行时机** | DOM 更新后（异步） | DOM 更新前（同步） |
| **阻塞渲染** | ❌ 不阻塞 | ⚠️ 会阻塞 |
| **适用场景** | 大多数副作用 | DOM 测量 |
| **推荐程度** | 🔥 默认使用 | ⚠️ 特殊场景 |

### 执行顺序

```
render
  ↓
React 更新 DOM
  ↓
useLayoutEffect 执行 ← 在浏览器绘制前
  ↓
浏览器绘制
  ↓
useEffect 执行 ← 在浏览器绘制后
```

### 代码示例

```jsx
// ========== useEffect（大多数情况） ==========
function Example() {
  useEffect(() => {
    // 数据获取、订阅等
    console.log('在浏览器绘制后执行');
  }, []);
}

// ========== useLayoutEffect（特殊场景） ==========
function Example() {
  const divRef = useRef();
  
  useLayoutEffect(() => {
    // 需要在浏览器绘制前测量 DOM
    const height = divRef.current.offsetHeight;
    console.log('高度：', height);
  }, []);
  
  return <div ref={divRef}>内容</div>;
}
```

### 选择建议

```
✅ 99% 的情况：使用 useEffect
  └─ 数据获取
  └─ 订阅
  └─ 定时器
  └─ 日志记录

⚠️ 1% 的情况：使用 useLayoutEffect
  └─ 需要测量 DOM
  └─ 需要在绘制前修改 DOM
  └─ 避免闪烁
```

---

## 6. useMemo vs useCallback

### 对比表

| 特性 | useMemo | useCallback |
|------|---------|------------|
| **缓存内容** | 计算结果（值） | 函数本身 |
| **返回值** | 任意值 | 函数 |
| **用途** | 避免重复计算 | 避免函数重新创建 |

### 代码对比

```jsx
// ========== useMemo：缓存值 ==========
function Example({ items }) {
  // 缓存计算结果
  const total = useMemo(() => {
    console.log('计算 total');
    return items.reduce((sum, item) => sum + item.price, 0);
  }, [items]);  // 只在 items 变化时重新计算
  
  return <div>总计：{total}</div>;
}

// ========== useCallback：缓存函数 ==========
function Parent() {
  const [count, setCount] = useState(0);
  
  // 缓存函数
  const handleClick = useCallback(() => {
    console.log('点击了');
  }, []);  // 函数永不变化
  
  return <Child onClick={handleClick} />;
}
```

### 等价写法

```jsx
// useMemo 和 useCallback 的关系
useCallback(fn, deps)  // 等价于
useMemo(() => fn, deps)
```

### 选择建议

```
✅ 使用 useMemo 当：
  └─ 计算成本高
  └─ 避免子组件不必要的渲染

✅ 使用 useCallback 当：
  └─ 函数作为 props 传递给子组件
  └─ 函数是其他 Hook 的依赖
```

---

## 7. createElement vs JSX

### 对比表

| 特性 | createElement | JSX |
|------|--------------|-----|
| **语法** | 函数调用 | 类 HTML |
| **可读性** | ⚠️ 较差 | ✅ 好 |
| **编译** | 不需要 | 需要 Babel |
| **使用频率** | 很少 | 非常多 |

### 代码对比

```jsx
// ========== JSX（推荐） ==========
const element = (
  <div className="container">
    <h1>标题</h1>
    <p>内容</p>
  </div>
);

// ========== createElement（实际执行的代码） ==========
const element = React.createElement(
  'div',
  { className: 'container' },
  React.createElement('h1', null, '标题'),
  React.createElement('p', null, '内容')
);
```

### 转换规则

```jsx
// JSX 转换规则

// 1. 标签名 → 第一个参数
<div>    →  React.createElement('div', ...)

// 2. 属性 → 第二个参数（对象）
<div className="box">  →  React.createElement('div', { className: 'box' }, ...)

// 3. 子元素 → 后续参数
<div>内容</div>  →  React.createElement('div', null, '内容')
```

---

## 8. 合成事件 vs 原生事件

### 对比表

| 特性 | React 合成事件 | 原生 DOM 事件 |
|------|--------------|-------------|
| **绑定方式** | onClick={fn} | addEventListener |
| **事件对象** | SyntheticEvent | Event |
| **命名规范** | 驼峰命名 | 全小写 |
| **性能** | ✅ 优化过 | 一般 |
| **兼容性** | ✅ 跨浏览器 | ⚠️ 可能有差异 |

### 代码对比

```jsx
// ========== React 合成事件 ==========
function Example() {
  function handleClick(e) {
    e.preventDefault();  // 合成事件对象
    console.log(e.type);  // 'click'
  }
  
  return <button onClick={handleClick}>点击</button>;
}

// ========== 原生事件 ==========
import { useEffect, useRef } from 'react';

function Example() {
  const buttonRef = useRef();
  
  useEffect(() => {
    const button = buttonRef.current;
    
    function handleClick(e) {
      e.preventDefault();  // 原生事件对象
      console.log(e.type);  // 'click'
    }
    
    button.addEventListener('click', handleClick);
    
    return () => {
      button.removeEventListener('click', handleClick);
    };
  }, []);
  
  return <button ref={buttonRef}>点击</button>;
}
```

### 事件名称对照

| React（驼峰） | 原生（小写） |
|--------------|------------|
| onClick | click |
| onChange | change |
| onSubmit | submit |
| onKeyDown | keydown |
| onMouseOver | mouseover |

---

## 9. key 的作用

### 为什么需要 key？

```jsx
// 没有 key 的问题
function Bad() {
  const items = ['A', 'B', 'C'];
  
  return (
    <ul>
      {/* ❌ 没有 key */}
      {items.map(item => <li>{item}</li>)}
    </ul>
  );
}

// React 无法知道哪个元素是哪个
// 如果列表顺序变化，React 可能会：
//   1. 删除所有元素
//   2. 重新创建所有元素
//   3. 性能差，可能有 bug

// 有 key 的好处
function Good() {
  const items = [
    { id: 1, text: 'A' },
    { id: 2, text: 'B' },
    { id: 3, text: 'C' }
  ];
  
  return (
    <ul>
      {/* ✅ 有唯一 key */}
      {items.map(item => (
        <li key={item.id}>{item.text}</li>
      ))}
    </ul>
  );
}

// React 知道每个元素的身份
// 列表顺序变化时，React 可以：
//   1. 知道哪些元素移动了
//   2. 只移动，不删除重建
//   3. 性能好，没有 bug
```

### key 的选择

```
❌ 不好的 key：
  └─ 数组索引（可能导致 bug）
  └─ 随机数（每次都变）
  └─ 日期（可能重复）

✅ 好的 key：
  └─ 数据库 ID
  └─ 唯一标识符
  └─ 稳定的业务 ID
```

---

## 10. 常见 Hooks 对比

### Hooks 速查表

| Hook | 用途 | 返回值 |
|------|------|--------|
| useState | 管理状态 | [state, setState] |
| useEffect | 副作用 | undefined |
| useContext | 读取 Context | context 值 |
| useReducer | 复杂状态 | [state, dispatch] |
| useCallback | 缓存函数 | 缓存的函数 |
| useMemo | 缓存值 | 缓存的值 |
| useRef | 引用值/DOM | ref 对象 |
| useLayoutEffect | 同步副作用 | undefined |

### 使用频率

```
🔥🔥🔥 非常常用：
  └─ useState
  └─ useEffect

🔥🔥 常用：
  └─ useContext
  └─ useRef

🔥 偶尔使用：
  └─ useCallback
  └─ useMemo
  └─ useReducer

⚠️ 很少使用：
  └─ useLayoutEffect
```

---

## 📝 总结：记忆口诀

```
Props 父传子，只读不能改
State 组件有，变化会渲染

函数组件配 Hooks，简洁又高效
类组件是过去，不推荐新写

受控组件 state 管，实时验证棒
非受控用 ref 取，特殊场景用

useState 简单用，useReducer 复杂选
useEffect 副作用，大多数都够用

useMemo 缓存值，useCallback 缓存函数
需要优化再使用，不要过早优化

key 要唯一稳定，帮助 React 识别
永远不用索引，数据 ID 最靠谱
```

---

**快速查阅这个表格，让你不再混淆！** 📖
