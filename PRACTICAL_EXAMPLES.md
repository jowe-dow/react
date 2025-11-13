# React 实战示例集合

本文档提供 React 的实际代码示例，帮助初学者通过实践掌握 React 的核心概念和用法。

## 目录

1. [基础组件](#基础组件)
2. [Hooks 示例](#hooks-示例)
3. [状态管理](#状态管理)
4. [副作用处理](#副作用处理)
5. [性能优化](#性能优化)
6. [常见模式](#常见模式)
7. [实战项目示例](#实战项目示例)

---

## 基础组件

### 1. 函数组件

```jsx
// 简单的问候组件
function Greeting({ name }) {
  return <h1>你好，{name}！</h1>;
}

// 使用
function App() {
  return <Greeting name="张三" />;
}
```

### 2. 类组件

```jsx
import React, { Component } from 'react';

class Welcome extends Component {
  render() {
    return <h1>欢迎，{this.props.name}！</h1>;
  }
}
```

### 3. 组件组合

```jsx
// 头部组件
function Header() {
  return (
    <header>
      <h1>我的网站</h1>
      <nav>
        <a href="#home">首页</a>
        <a href="#about">关于</a>
      </nav>
    </header>
  );
}

// 主内容组件
function Main({ children }) {
  return <main>{children}</main>;
}

// 页脚组件
function Footer() {
  return (
    <footer>
      <p>&copy; 2025 我的网站</p>
    </footer>
  );
}

// 布局组件
function Layout({ children }) {
  return (
    <div className="layout">
      <Header />
      <Main>{children}</Main>
      <Footer />
    </div>
  );
}

// 应用
function App() {
  return (
    <Layout>
      <h2>欢迎来到首页</h2>
      <p>这是主要内容区域。</p>
    </Layout>
  );
}
```

---

## Hooks 示例

### 1. useState - 状态管理

```jsx
import { useState } from 'react';

// 计数器示例
function Counter() {
  const [count, setCount] = useState(0);

  return (
    <div>
      <p>当前计数：{count}</p>
      <button onClick={() => setCount(count + 1)}>+1</button>
      <button onClick={() => setCount(count - 1)}>-1</button>
      <button onClick={() => setCount(0)}>重置</button>
    </div>
  );
}

// 表单输入示例
function LoginForm() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    console.log('登录信息：', { username, password });
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        type="text"
        value={username}
        onChange={(e) => setUsername(e.target.value)}
        placeholder="用户名"
      />
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="密码"
      />
      <button type="submit">登录</button>
    </form>
  );
}

// 对象状态示例
function UserProfile() {
  const [user, setUser] = useState({
    name: '张三',
    age: 25,
    email: 'zhangsan@example.com'
  });

  const updateName = (newName) => {
    setUser(prevUser => ({
      ...prevUser,
      name: newName
    }));
  };

  return (
    <div>
      <h2>{user.name}</h2>
      <p>年龄：{user.age}</p>
      <p>邮箱：{user.email}</p>
      <button onClick={() => updateName('李四')}>
        改名为李四
      </button>
    </div>
  );
}
```

### 2. useEffect - 副作用处理

```jsx
import { useState, useEffect } from 'react';

// 文档标题更新
function DocumentTitle() {
  const [count, setCount] = useState(0);

  useEffect(() => {
    document.title = `你点击了 ${count} 次`;
  }, [count]); // count 变化时执行

  return (
    <button onClick={() => setCount(count + 1)}>
      点击次数：{count}
    </button>
  );
}

// 数据获取
function UserList() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    // 获取用户列表
    fetch('https://jsonplaceholder.typicode.com/users')
      .then(response => response.json())
      .then(data => {
        setUsers(data);
        setLoading(false);
      })
      .catch(err => {
        setError(err.message);
        setLoading(false);
      });
  }, []); // 只在组件挂载时执行一次

  if (loading) return <div>加载中...</div>;
  if (error) return <div>错误：{error}</div>;

  return (
    <ul>
      {users.map(user => (
        <li key={user.id}>{user.name}</li>
      ))}
    </ul>
  );
}

// 订阅和清理
function WindowSize() {
  const [size, setSize] = useState({
    width: window.innerWidth,
    height: window.innerHeight
  });

  useEffect(() => {
    const handleResize = () => {
      setSize({
        width: window.innerWidth,
        height: window.innerHeight
      });
    };

    // 订阅事件
    window.addEventListener('resize', handleResize);

    // 清理函数
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []); // 空依赖数组，只在挂载和卸载时执行

  return (
    <div>
      窗口大小：{size.width} x {size.height}
    </div>
  );
}

// 计时器示例
function Timer() {
  const [seconds, setSeconds] = useState(0);
  const [isRunning, setIsRunning] = useState(false);

  useEffect(() => {
    if (!isRunning) return;

    const interval = setInterval(() => {
      setSeconds(s => s + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning]);

  return (
    <div>
      <p>时间：{seconds} 秒</p>
      <button onClick={() => setIsRunning(!isRunning)}>
        {isRunning ? '暂停' : '开始'}
      </button>
      <button onClick={() => setSeconds(0)}>重置</button>
    </div>
  );
}
```

### 3. useContext - 跨组件传递数据

```jsx
import { createContext, useContext, useState } from 'react';

// 创建主题 Context
const ThemeContext = createContext();

// 主题提供者组件
function ThemeProvider({ children }) {
  const [theme, setTheme] = useState('light');

  const toggleTheme = () => {
    setTheme(prevTheme => prevTheme === 'light' ? 'dark' : 'light');
  };

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

// 使用主题的组件
function ThemedButton() {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <button
      onClick={toggleTheme}
      style={{
        background: theme === 'light' ? '#fff' : '#333',
        color: theme === 'light' ? '#333' : '#fff'
      }}
    >
      切换主题 (当前: {theme})
    </button>
  );
}

// 应用
function App() {
  return (
    <ThemeProvider>
      <div>
        <h1>主题切换示例</h1>
        <ThemedButton />
      </div>
    </ThemeProvider>
  );
}

// 用户认证 Context 示例
const AuthContext = createContext();

function AuthProvider({ children }) {
  const [user, setUser] = useState(null);

  const login = (username, password) => {
    // 模拟登录
    setUser({ username, id: 1 });
  };

  const logout = () => {
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

function UserInfo() {
  const { user, logout } = useContext(AuthContext);

  if (!user) {
    return <div>未登录</div>;
  }

  return (
    <div>
      <p>欢迎，{user.username}！</p>
      <button onClick={logout}>登出</button>
    </div>
  );
}
```

### 4. useReducer - 复杂状态管理

```jsx
import { useReducer } from 'react';

// 购物车示例
const initialState = {
  items: [],
  total: 0
};

function cartReducer(state, action) {
  switch (action.type) {
    case 'ADD_ITEM':
      const newItem = action.payload;
      const existingItem = state.items.find(item => item.id === newItem.id);
      
      if (existingItem) {
        return {
          ...state,
          items: state.items.map(item =>
            item.id === newItem.id
              ? { ...item, quantity: item.quantity + 1 }
              : item
          ),
          total: state.total + newItem.price
        };
      }
      
      return {
        ...state,
        items: [...state.items, { ...newItem, quantity: 1 }],
        total: state.total + newItem.price
      };

    case 'REMOVE_ITEM':
      const itemToRemove = state.items.find(item => item.id === action.payload);
      return {
        ...state,
        items: state.items.filter(item => item.id !== action.payload),
        total: state.total - (itemToRemove.price * itemToRemove.quantity)
      };

    case 'CLEAR_CART':
      return initialState;

    default:
      return state;
  }
}

function ShoppingCart() {
  const [state, dispatch] = useReducer(cartReducer, initialState);

  const addItem = (item) => {
    dispatch({ type: 'ADD_ITEM', payload: item });
  };

  const removeItem = (id) => {
    dispatch({ type: 'REMOVE_ITEM', payload: id });
  };

  const clearCart = () => {
    dispatch({ type: 'CLEAR_CART' });
  };

  return (
    <div>
      <h2>购物车</h2>
      <ul>
        {state.items.map(item => (
          <li key={item.id}>
            {item.name} x {item.quantity} = ¥{item.price * item.quantity}
            <button onClick={() => removeItem(item.id)}>删除</button>
          </li>
        ))}
      </ul>
      <p>总计：¥{state.total}</p>
      <button onClick={clearCart}>清空购物车</button>
      
      {/* 示例商品 */}
      <div>
        <h3>商品列表</h3>
        <button onClick={() => addItem({ id: 1, name: '苹果', price: 5 })}>
          添加苹果 (¥5)
        </button>
        <button onClick={() => addItem({ id: 2, name: '香蕉', price: 3 })}>
          添加香蕉 (¥3)
        </button>
      </div>
    </div>
  );
}
```

### 5. useMemo - 性能优化

```jsx
import { useState, useMemo } from 'react';

function ExpensiveCalculation({ numbers }) {
  const [multiplier, setMultiplier] = useState(1);

  // 只在 numbers 或 multiplier 变化时重新计算
  const result = useMemo(() => {
    console.log('执行昂贵的计算...');
    return numbers.reduce((sum, num) => sum + num, 0) * multiplier;
  }, [numbers, multiplier]);

  return (
    <div>
      <p>结果：{result}</p>
      <button onClick={() => setMultiplier(m => m + 1)}>
        乘数 +1 (当前: {multiplier})
      </button>
    </div>
  );
}

// 过滤和排序列表
function SearchableList({ items }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [sortBy, setSortBy] = useState('name');

  // 过滤和排序只在依赖变化时执行
  const processedItems = useMemo(() => {
    console.log('处理列表...');
    return items
      .filter(item => 
        item.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
      .sort((a, b) => {
        if (sortBy === 'name') {
          return a.name.localeCompare(b.name);
        }
        return a.price - b.price;
      });
  }, [items, searchTerm, sortBy]);

  return (
    <div>
      <input
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        placeholder="搜索商品..."
      />
      <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
        <option value="name">按名称排序</option>
        <option value="price">按价格排序</option>
      </select>
      <ul>
        {processedItems.map(item => (
          <li key={item.id}>
            {item.name} - ¥{item.price}
          </li>
        ))}
      </ul>
    </div>
  );
}
```

### 6. useCallback - 函数缓存

```jsx
import { useState, useCallback, memo } from 'react';

// 子组件（使用 memo 优化）
const ChildComponent = memo(({ onItemClick }) => {
  console.log('子组件渲染');
  return (
    <button onClick={() => onItemClick(42)}>
      点击我
    </button>
  );
});

function ParentComponent() {
  const [count, setCount] = useState(0);
  const [items, setItems] = useState([]);

  // 使用 useCallback 缓存函数
  const handleItemClick = useCallback((id) => {
    console.log('点击了项目:', id);
    setItems(prevItems => [...prevItems, id]);
  }, []); // 空依赖，函数永不变化

  return (
    <div>
      <p>计数：{count}</p>
      <button onClick={() => setCount(c => c + 1)}>增加计数</button>
      
      {/* 即使 count 变化，ChildComponent 也不会重新渲染 */}
      <ChildComponent onItemClick={handleItemClick} />
      
      <p>项目：{items.join(', ')}</p>
    </div>
  );
}

// 表格排序示例
function SortableTable({ data }) {
  const [sortKey, setSortKey] = useState(null);
  const [sortOrder, setSortOrder] = useState('asc');

  // 排序函数只在 sortKey 或 sortOrder 变化时重新创建
  const sortData = useCallback((items) => {
    if (!sortKey) return items;

    return [...items].sort((a, b) => {
      if (a[sortKey] < b[sortKey]) return sortOrder === 'asc' ? -1 : 1;
      if (a[sortKey] > b[sortKey]) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [sortKey, sortOrder]);

  const sortedData = sortData(data);

  return (
    <table>
      <thead>
        <tr>
          <th onClick={() => setSortKey('name')}>姓名</th>
          <th onClick={() => setSortKey('age')}>年龄</th>
        </tr>
      </thead>
      <tbody>
        {sortedData.map(item => (
          <tr key={item.id}>
            <td>{item.name}</td>
            <td>{item.age}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
```

### 7. useRef - 引用 DOM 和保存值

```jsx
import { useRef, useState, useEffect } from 'react';

// 聚焦输入框
function FocusInput() {
  const inputRef = useRef(null);

  const handleFocus = () => {
    inputRef.current.focus();
  };

  return (
    <div>
      <input ref={inputRef} type="text" />
      <button onClick={handleFocus}>聚焦输入框</button>
    </div>
  );
}

// 保存前一个值
function PreviousValue() {
  const [count, setCount] = useState(0);
  const prevCountRef = useRef();

  useEffect(() => {
    prevCountRef.current = count;
  }, [count]);

  const prevCount = prevCountRef.current;

  return (
    <div>
      <p>当前值：{count}</p>
      <p>前一个值：{prevCount}</p>
      <button onClick={() => setCount(c => c + 1)}>增加</button>
    </div>
  );
}

// 视频播放器
function VideoPlayer() {
  const videoRef = useRef(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const togglePlay = () => {
    if (isPlaying) {
      videoRef.current.pause();
    } else {
      videoRef.current.play();
    }
    setIsPlaying(!isPlaying);
  };

  return (
    <div>
      <video ref={videoRef} width="400">
        <source src="video.mp4" type="video/mp4" />
      </video>
      <button onClick={togglePlay}>
        {isPlaying ? '暂停' : '播放'}
      </button>
    </div>
  );
}

// 计时器（不触发重新渲染）
function IntervalTimer() {
  const [count, setCount] = useState(0);
  const intervalRef = useRef(null);

  const startTimer = () => {
    if (intervalRef.current) return;
    
    intervalRef.current = setInterval(() => {
      setCount(c => c + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  };

  useEffect(() => {
    return () => stopTimer(); // 清理
  }, []);

  return (
    <div>
      <p>计数：{count}</p>
      <button onClick={startTimer}>开始</button>
      <button onClick={stopTimer}>停止</button>
      <button onClick={() => setCount(0)}>重置</button>
    </div>
  );
}
```

---

## 性能优化

### 1. React.memo - 防止不必要的重新渲染

```jsx
import { memo, useState } from 'react';

// 未优化的子组件
function NormalChild({ name }) {
  console.log('NormalChild 渲染');
  return <div>普通子组件: {name}</div>;
}

// 使用 memo 优化的子组件
const MemoizedChild = memo(function MemoizedChild({ name }) {
  console.log('MemoizedChild 渲染');
  return <div>优化的子组件: {name}</div>;
});

// 自定义比较函数
const CustomMemoChild = memo(
  function CustomMemoChild({ user }) {
    console.log('CustomMemoChild 渲染');
    return <div>用户: {user.name}</div>;
  },
  (prevProps, nextProps) => {
    // 只比较 user.name，忽略其他属性
    return prevProps.user.name === nextProps.user.name;
  }
);

function Parent() {
  const [count, setCount] = useState(0);
  const [name, setName] = useState('张三');

  return (
    <div>
      <button onClick={() => setCount(c => c + 1)}>
        计数: {count}
      </button>
      <button onClick={() => setName('李四')}>
        改名
      </button>
      
      {/* 每次都重新渲染 */}
      <NormalChild name={name} />
      
      {/* 只在 name 变化时重新渲染 */}
      <MemoizedChild name={name} />
    </div>
  );
}
```

### 2. 代码分割和懒加载

```jsx
import { lazy, Suspense, useState } from 'react';

// 懒加载组件
const HeavyComponent = lazy(() => import('./HeavyComponent'));
const Dashboard = lazy(() => import('./Dashboard'));
const Settings = lazy(() => import('./Settings'));

function App() {
  const [showHeavy, setShowHeavy] = useState(false);

  return (
    <div>
      <button onClick={() => setShowHeavy(!showHeavy)}>
        {showHeavy ? '隐藏' : '显示'}大型组件
      </button>

      {showHeavy && (
        <Suspense fallback={<div>加载中...</div>}>
          <HeavyComponent />
        </Suspense>
      )}
    </div>
  );
}

// 路由懒加载
function Router() {
  const [page, setPage] = useState('dashboard');

  return (
    <div>
      <nav>
        <button onClick={() => setPage('dashboard')}>仪表盘</button>
        <button onClick={() => setPage('settings')}>设置</button>
      </nav>

      <Suspense fallback={<div>页面加载中...</div>}>
        {page === 'dashboard' && <Dashboard />}
        {page === 'settings' && <Settings />}
      </Suspense>
    </div>
  );
}
```

### 3. 虚拟列表

```jsx
import { useState } from 'react';

// 简单的虚拟列表实现
function VirtualList({ items, itemHeight, containerHeight }) {
  const [scrollTop, setScrollTop] = useState(0);

  const visibleCount = Math.ceil(containerHeight / itemHeight);
  const startIndex = Math.floor(scrollTop / itemHeight);
  const endIndex = Math.min(startIndex + visibleCount + 1, items.length);
  
  const visibleItems = items.slice(startIndex, endIndex);
  const offsetY = startIndex * itemHeight;

  return (
    <div
      style={{ height: containerHeight, overflow: 'auto' }}
      onScroll={(e) => setScrollTop(e.target.scrollTop)}
    >
      <div style={{ height: items.length * itemHeight, position: 'relative' }}>
        <div style={{ transform: `translateY(${offsetY}px)` }}>
          {visibleItems.map((item, index) => (
            <div
              key={startIndex + index}
              style={{ height: itemHeight }}
            >
              项目 {startIndex + index}: {item}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// 使用示例
function App() {
  const items = Array.from({ length: 10000 }, (_, i) => `项目 ${i}`);

  return (
    <VirtualList
      items={items}
      itemHeight={30}
      containerHeight={400}
    />
  );
}
```

---

## 实战项目示例

### 待办事项应用（完整版）

```jsx
import { useState, useEffect } from 'react';

function TodoApp() {
  const [todos, setTodos] = useState(() => {
    // 从 localStorage 加载
    const saved = localStorage.getItem('todos');
    return saved ? JSON.parse(saved) : [];
  });
  const [input, setInput] = useState('');
  const [filter, setFilter] = useState('all'); // all, active, completed

  // 保存到 localStorage
  useEffect(() => {
    localStorage.setItem('todos', JSON.stringify(todos));
  }, [todos]);

  const addTodo = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    setTodos([
      ...todos,
      {
        id: Date.now(),
        text: input,
        completed: false,
        createdAt: new Date().toISOString()
      }
    ]);
    setInput('');
  };

  const toggleTodo = (id) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, completed: !todo.completed } : todo
    ));
  };

  const deleteTodo = (id) => {
    setTodos(todos.filter(todo => todo.id !== id));
  };

  const editTodo = (id, newText) => {
    setTodos(todos.map(todo =>
      todo.id === id ? { ...todo, text: newText } : todo
    ));
  };

  const clearCompleted = () => {
    setTodos(todos.filter(todo => !todo.completed));
  };

  // 过滤待办事项
  const filteredTodos = todos.filter(todo => {
    if (filter === 'active') return !todo.completed;
    if (filter === 'completed') return todo.completed;
    return true;
  });

  const activeCount = todos.filter(t => !t.completed).length;

  return (
    <div className="todo-app">
      <h1>待办事项</h1>
      
      {/* 添加表单 */}
      <form onSubmit={addTodo}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="添加新任务..."
        />
        <button type="submit">添加</button>
      </form>

      {/* 过滤器 */}
      <div className="filters">
        <button
          className={filter === 'all' ? 'active' : ''}
          onClick={() => setFilter('all')}
        >
          全部 ({todos.length})
        </button>
        <button
          className={filter === 'active' ? 'active' : ''}
          onClick={() => setFilter('active')}
        >
          进行中 ({activeCount})
        </button>
        <button
          className={filter === 'completed' ? 'active' : ''}
          onClick={() => setFilter('completed')}
        >
          已完成 ({todos.length - activeCount})
        </button>
      </div>

      {/* 待办列表 */}
      <ul className="todo-list">
        {filteredTodos.map(todo => (
          <TodoItem
            key={todo.id}
            todo={todo}
            onToggle={toggleTodo}
            onDelete={deleteTodo}
            onEdit={editTodo}
          />
        ))}
      </ul>

      {/* 底部操作 */}
      {todos.length > 0 && (
        <div className="footer">
          <span>{activeCount} 项未完成</span>
          <button onClick={clearCompleted}>清除已完成</button>
        </div>
      )}
    </div>
  );
}

// 单个待办项组件
function TodoItem({ todo, onToggle, onDelete, onEdit }) {
  const [isEditing, setIsEditing] = useState(false);
  const [editText, setEditText] = useState(todo.text);

  const handleEdit = () => {
    if (editText.trim()) {
      onEdit(todo.id, editText);
      setIsEditing(false);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleEdit();
    } else if (e.key === 'Escape') {
      setEditText(todo.text);
      setIsEditing(false);
    }
  };

  return (
    <li className={todo.completed ? 'completed' : ''}>
      {isEditing ? (
        <input
          value={editText}
          onChange={(e) => setEditText(e.target.value)}
          onBlur={handleEdit}
          onKeyDown={handleKeyDown}
          autoFocus
        />
      ) : (
        <>
          <input
            type="checkbox"
            checked={todo.completed}
            onChange={() => onToggle(todo.id)}
          />
          <span onDoubleClick={() => setIsEditing(true)}>
            {todo.text}
          </span>
          <button onClick={() => onDelete(todo.id)}>删除</button>
        </>
      )}
    </li>
  );
}

export default TodoApp;
```

---

## 总结

这些示例涵盖了 React 开发中最常用的模式和技巧：

1. **基础组件**：函数组件、类组件、组件组合
2. **Hooks**：useState, useEffect, useContext, useReducer, useMemo, useCallback, useRef
3. **性能优化**：React.memo, 代码分割, 虚拟列表
4. **实战项目**：完整的待办事项应用

**学习建议**：
- 从简单的示例开始，逐步理解每个概念
- 动手实践每个示例，修改代码观察变化
- 尝试组合多个概念，构建更复杂的应用
- 关注性能优化，养成良好的编程习惯

**下一步**：
- 学习 TypeScript 增强类型安全
- 学习状态管理库（Redux, Zustand）
- 学习 React Router 进行路由管理
- 学习测试（Jest, React Testing Library）

祝你学习愉快！🎉
