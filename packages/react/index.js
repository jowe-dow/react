/**
 * Copyright (c) Meta Platforms, Inc. and affiliates.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 *
 * @flow
 */

// ============================================================================
// 类型定义（Type Definitions）
// ============================================================================
// 这些是 Flow 类型定义，用于 TypeScript/Flow 类型检查
// 与 https://github.com/facebook/flow/blob/main/lib/react.js 保持同步

// 元素类型：表示 React 元素的类型（如 'div', 'span', 或自定义组件）
export type ElementType = React$ElementType;

// 元素：表示一个 React 元素，C 是组件的类型
export type Element<+C> = React$Element<C>;

// 混合元素：可以是任何类型的 React 元素
export type MixedElement = React$Element<ElementType>;

// Key：React 列表渲染时使用的唯一标识符
export type Key = React$Key;

// Node：React 可以渲染的节点类型（元素、字符串、数字等）
export type Node = React$Node;

// Context：React Context 的类型，用于跨组件传递数据
export type Context<T> = React$Context<T>;

// Portal：用于将子节点渲染到 DOM 树的不同位置
export type Portal = React$Portal;

// RefSetter：用于设置 ref 的函数类型
export type RefSetter<-I> = React$RefSetter<I>;

// ElementProps：获取组件 C 的 props 类型
export type ElementProps<C> = React$ElementProps<C>;

// ElementConfig：获取组件 C 的配置类型
export type ElementConfig<C> = React$ElementConfig<C>;

// ElementRef：获取组件 C 的 ref 类型
export type ElementRef<C> = React$ElementRef<C>;

// ChildrenArray：子元素的数组类型，可以是嵌套数组或单个元素
export type ChildrenArray<+T> = $ReadOnlyArray<ChildrenArray<T>> | T;

// ====================x========================================================
// React API 导出（从 ReactClient 模块导入并重新导出）
// ============================================================================
export {
  // ------------------------------------------------------------------------
  // 内部 API（Internal APIs）
  // 警告：这些是 React 内部使用的 API，普通开发者不应该使用
  // ------------------------------------------------------------------------
  __CLIENT_INTERNALS_DO_NOT_USE_OR_WARN_USERS_THEY_CANNOT_UPGRADE, // React 客户端内部实现
  __COMPILER_RUNTIME, // React 编译器运行时

  // ------------------------------------------------------------------------
  // 工具函数（Utilities）
  // ------------------------------------------------------------------------
  Children, // 操作子元素的工具方法集合（map, forEach, count, toArray, only）

  // ------------------------------------------------------------------------
  // 组件类（Component Classes）
  // 用于创建类组件的基类
  // ------------------------------------------------------------------------
  Component, // React 组件基类，所有类组件都继承自它
  PureComponent, // 纯组件，自动进行浅比较优化，避免不必要的重渲染

  // ------------------------------------------------------------------------
  // 特殊组件（Special Components）
  // React 提供的内置特殊用途组件
  // ------------------------------------------------------------------------
  Fragment, // 片段组件，用于包裹多个元素而不添加额外的 DOM 节点
  StrictMode, // 严格模式，帮助发现潜在问题，只在开发环境生效
  Suspense, // 异步组件加载时的占位组件，用于代码分割和异步数据加载
  Profiler, // 性能分析组件，用于测量组件渲染性能

  // ------------------------------------------------------------------------
  // 创建 API（Creation APIs）
  // 用于创建 React 元素、上下文、引用等
  // ------------------------------------------------------------------------
  createElement, // 创建 React 元素（JSX 的底层实现）
  cloneElement, // 克隆并修改现有的 React 元素
  createContext, // 创建 Context，用于跨组件传递数据
  createRef, // 创建 ref 对象，用于访问 DOM 节点或组件实例

  // ------------------------------------------------------------------------
  // 高阶组件和工具函数（HOCs and Utilities）
  // 用于增强组件功能或提供工具方法
  // ------------------------------------------------------------------------
  forwardRef, // 转发 ref 到子组件，用于函数组件接收 ref
  memo, // 记忆化组件，类似 PureComponent，用于函数组件优化
  lazy, // 懒加载组件，用于代码分割和按需加载
  isValidElement, // 检查一个值是否是有效的 React 元素
  use, // 读取 Promise 或 Context 的值

  // ------------------------------------------------------------------------
  // 缓存 API（Cache APIs）
  // 用于缓存计算结果，避免重复计算
  // ------------------------------------------------------------------------
  cache, // 缓存函数调用结果
  cacheSignal, // 缓存信号（Signal），用于响应式数据

  // ------------------------------------------------------------------------
  // 过渡 API（Transition APIs）
  // 用于管理 UI 过渡和动画
  // ------------------------------------------------------------------------
  startTransition, // 标记非紧急的状态更新，让 React 优先处理紧急更新
  ViewTransition, // 视图过渡 API，用于页面切换动画
  addTransitionType, // 添加过渡类型

  // ------------------------------------------------------------------------
  // 不稳定 API（Unstable APIs）
  // 这些 API 可能会在未来版本中改变，使用时需谨慎
  // ------------------------------------------------------------------------
  unstable_LegacyHidden, // 遗留的隐藏组件 API
  unstable_Scope, // 作用域组件（实验性）
  unstable_SuspenseList, // 管理多个 Suspense 组件的顺序
  unstable_TracingMarker, // 追踪标记（用于性能分析）
  unstable_getCacheForType, // 获取指定类型的缓存
  unstable_useCacheRefresh, // 刷新缓存的 Hook

  // ------------------------------------------------------------------------
  // 实验性 API（Experimental APIs）
  // ------------------------------------------------------------------------
  Activity, // 活动组件（实验性功能）

  // ------------------------------------------------------------------------
  // Hooks - 状态管理（Hooks - State）
  // 用于在函数组件中管理组件状态
  // ------------------------------------------------------------------------
  useState, // 最基础的状态 Hook，用于添加状态到函数组件
  useReducer, // 复杂状态管理 Hook，类似 Redux 的 reducer 模式
  useRef, // 创建可变引用，不会触发重渲染，常用于保存 DOM 引用或前一个值
  useId, // 生成唯一 ID，用于无障碍访问（a11y）

  // ------------------------------------------------------------------------
  // Hooks - 副作用（Hooks - Effects）
  // 用于处理副作用，如数据获取、订阅、手动 DOM 操作等
  // ------------------------------------------------------------------------
  useEffect, // 最常用的副作用 Hook，在渲染后执行
  useLayoutEffect, // 同步副作用 Hook，在 DOM 更新后、浏览器绘制前执行
  useInsertionEffect, // 插入效果 Hook，用于 CSS-in-JS 库注入样式
  useEffectEvent, // 事件效果 Hook，用于处理事件相关的副作用

  // ------------------------------------------------------------------------
  // Hooks - 上下文（Hooks - Context）
  // 用于访问 React Context
  // ------------------------------------------------------------------------
  useContext, // 读取 Context 的值

  // ------------------------------------------------------------------------
  // Hooks - 记忆化（Hooks - Memoization）
  // 用于优化性能，缓存计算结果
  // ------------------------------------------------------------------------
  useMemo, // 记忆化计算结果，只有依赖变化时才重新计算
  useCallback, // 记忆化函数，只有依赖变化时才返回新函数

  // ------------------------------------------------------------------------
  // Hooks - 过渡（Hooks - Transitions）
  // 用于管理非紧急的状态更新
  // ------------------------------------------------------------------------
  useTransition, // 返回过渡状态和启动过渡的函数
  useDeferredValue, // 延迟更新值，用于保持 UI 响应性

  // ------------------------------------------------------------------------
  // Hooks - 外部存储（Hooks - External Store）
  // 用于订阅外部数据源
  // ------------------------------------------------------------------------
  useSyncExternalStore, // 同步订阅外部存储（如 Redux store）

  // ------------------------------------------------------------------------
  // Hooks - 高级功能（Hooks - Advanced）
  // 用于特殊场景的高级 Hook
  // ------------------------------------------------------------------------
  useImperativeHandle, // 自定义暴露给父组件的 ref 值
  useDebugValue, // 在 React DevTools 中显示自定义 Hook 的标签
  useOptimistic, // 乐观更新 Hook，用于乐观 UI 更新
  useActionState, // 动作状态 Hook，用于表单提交等场景

  // ------------------------------------------------------------------------
  // 版本信息（Version）
  // ------------------------------------------------------------------------
  version, // React 的版本号
} from './src/ReactClient';
