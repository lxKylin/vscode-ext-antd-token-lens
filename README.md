# Ant Design Token Lens VS Code Extension

A plugin that makes Ant Design Tokens "visible, understandable, and actionable" in VS Code.

English | [简体中文](./README.zh-CN.md)

## Plugin Demo

![Example 1](./images/example-1.gif)

## Why You Need This Plugin

Ant Design provides `useToken` and `getDesignToken` to access Design Tokens, but only in React runtime environments. In `.css`, `.less` and other style files, or when using `Tailwind CSS`, directly using these JS variables often has limitations.

Especially with Design Tokens in `Tailwind CSS`, they usually **don't work**, and you're forced to fall back to **inline styles**.

As a `Tailwind CSS` user, I want to see token effects intuitively instead of dealing with abstract variable names. To solve this pain point and make tokens truly "visible" in VS Code, this plugin was created.

```html
<!-- Doesn't work -->
<div className="{`text-[${token.colorPrimary}]`}"></div>
<!-- Works -->
<div className="text-[var(--ant-color-primary)]"></div>
<div className="text-(--ant-color-primary)"></div>
```

`Tailwind CSS` generates styles at Build Time, while `token.colorPrimary` is a Runtime `JavaScript` variable.

Key Difference: Static string vs Dynamic interpolation

#### Why does `text-[var(--ant-color-primary)]`/`text-(--ant-color-primary)` work?

- Build stage: `Tailwind` scanner sees the complete static string `text-[var(--ant-color-primary)]`/`text-(--ant-color-primary)` in the source code. It doesn't need to execute JS to know you want an arbitrary value utility class.
- Generate CSS: It extracts the content in brackets and directly generates CSS rules like:
  ```css
  .text-\[var\(--ant-color-primary\)\] {
    color: var(--ant-color-primary);
  }
  ```
- Runtime stage: The browser reads this CSS. By this time, Ant Design has already injected `--ant-color-primary` into the html or body tag via JS, and the browser successfully resolves the variable, making the color work.

#### Why doesn't `text-[${token.colorPrimary}]` work?

- Build stage: `Tailwind` scanner sees `text-[${token.colorPrimary}]`. This is a template string with variables.
- Cannot predict: `Tailwind` only does static text analysis and doesn't execute `JavaScript`. It cannot know whether `token.colorPrimary` will become `#1677ff` or `red`.
- Result: Because it can't determine the class name, `Tailwind` gives up generating any CSS.
- Runtime stage: Although React renders the class name as `text-[#1677ff]`, the corresponding CSS rule doesn't exist, so the color doesn't work.

## Project Overview

When developing with Ant Design v5/v6, CSS Tokens (like `--ant-color-primary`) are abstract and developers can't intuitively see the actual color effects. This plugin aims to solve this pain point and make token usage more intuitive and efficient.

## Features

### ✅ Completed (Phase 1 + Phase 2 + Phase 3 + Phase 4)

#### Phase 1: Token Data Management

- ✅ Token Data Management: Complete token registry and query system
- ✅ Theme Management: Automatic Light/Dark theme detection and switching
- ✅ High Performance: 10,000 queries take only 1ms
- ✅ Type Safety: Complete TypeScript type definitions
- ✅ Comprehensive Tests: 35 test cases

#### Phase 2: Color Visualization

- ✅ **Smart Scanning**: Automatically identifies `var(--ant-*)` Tokens in code
- ✅ **Color Decorators**: Displays token colors directly in the editor
- ✅ **Real-time Updates**: Automatically updates color display when editing code or switching themes
- ✅ **Multiple Styles**: Square, circle, underline, background and other decoration styles
- ✅ **Multi-file Support**: Supports CSS, Less, Sass, JavaScript, TypeScript, JSX/TSX, Vue, HTML
- ✅ **High Performance**: Scans 1000 lines in < 50ms, supports large files
- ✅ **Configurable**: Flexible style, position, and size configuration

![Example 2 - Color Visualization](./images/example-2.png)

#### Phase 3: Hover Information Tooltip

- ✅ **Smart Hover Tooltip**: Shows detailed token information when hovering
- ✅ **Multi-theme Comparison**: Displays colors for both Light and Dark themes
- ✅ **Color Format Conversion**: Multiple formats including HEX, RGB, HSL
- ✅ **Enhanced Color Preview**: Color blocks with borders for clarity
- ✅ **Tiered Information Display**: Minimal, Normal, Detailed modes
- ✅ **Quick Commands**: Copy value, find references, switch theme, etc.
- ✅ **Performance Optimization**: Caching mechanism, debouncing, response < 100ms

![Example 3 - Hover Information Tooltip](./images/example-3.png)

#### Phase 4: Smart Auto-completion

- ✅ **Smart Triggering**: Auto-complete appears when typing `var(--`, `--ant` or `-(--)`
- ✅ **Context Aware**: Automatically selects the correct insertion format based on position
- ✅ **Intelligent Sorting**: Recently used first, exact match first, category first
- ✅ **Rich Information**: Shows token name, description, current value, color preview
- ✅ **Performance Optimization**: Multi-level caching, incremental filtering, response < 200ms
- ✅ **Snippet Support**: Automatically inserts `var()` syntax, supports fallback parameters
- ✅ **Highly Configurable**: Verbosity level, recent usage, and more

![Example 4 - Smart Auto-completion](./images/example-4.png)

## Usage Examples

### Color Visualization

```tsx
/* Blue color block will display here → */
<div className="text-(--ant-color-primary)"></div>
// Equivalent to
<div className="text-[var(--ant-color-primary)]"></div>
```

```css
.button {
  /* Blue color block will display here → */
  color: var(--ant-color-primary);

  /* Gray color block will display here → */
  background: var(--ant-color-bg-container);

  /* Border color will also display → */
  border: 1px solid var(--ant-color-border);
}
```

### Supported File Types

- **Style Files**: CSS, Less, Sass/Scss
- **Script Files**: JavaScript, TypeScript
- **Framework Files**: JSX, TSX (React), Vue
- **Markup Files**: HTML

### Hover Information Tooltip 🆕

Hover over any `var(--ant-*)` token to see detailed information:

- **Token Name and Semantics**: Understand the token's purpose
- **Current Theme Value**: View the actual value in the current theme
- **Multi-theme Comparison**: Display values for both Light and Dark themes
- **Color Format Conversion**: HEX, RGB, HSL and other formats
- **Color Preview**: Intuitive color block display
- **Quick Operations**: Copy value, find references, etc.

#### Hover Example

```css
.button {
  color: var(--ant-color-primary);
  /* Hover to see:
     🎨 --ant-color-primary
     Semantic: Brand primary color
     Current Theme (light): 🟦 #1677ff
     Multi-theme Comparison:
       - Light: 🟦 #1677ff
       - Dark: 🟦 #177ddc
     Color Formats:
       - HEX: #1677FF
       - RGB: rgb(22, 119, 255)
       - HSL: hsl(216, 100%, 54%)
  */
}
```

### Available Commands

Open the command palette (Cmd/Ctrl + Shift + P) and type:

- `Ant Design Token: Toggle Color Decorator` - Enable/disable color decorators
- `Ant Design Token: Refresh Token Decorations` - Refresh all decorations
- `Ant Design Token: Toggle Theme Preview` - Toggle theme preview (Shortcut: `Ctrl+Alt+T` / `Cmd+Alt+T`)
- `Ant Design Token: Refresh Token Data` - Refresh token data (Shortcut: `Ctrl+Alt+R` / `Cmd+Alt+R`)
- `Ant Design Token: Clear Recent Tokens` - Clear recent token usage history

### Configuration Options

Search for "antdToken" in VS Code settings:

```json
{
  // Theme Mode
  "antdToken.themeMode": "light", // "auto" | "light" | "dark"

  // Color Decorators
  "antdToken.colorDecorator.enabled": true,
  "antdToken.colorDecorator.style": "background", // "square" | "circle" | "underline" | "background"
  "antdToken.colorDecorator.position": "before", // "before" | "after"
  "antdToken.colorDecorator.size": "medium", // "small" | "medium" | "large"

  // Hover Tooltip
  "antdToken.enableHover": true,
  "antdToken.showMultiTheme": true, // Show multi-theme comparison
  "antdToken.showColorFormats": true, // Show color format conversion
  "antdToken.hoverVerbosity": "normal", // "minimal" | "normal" | "detailed"

  // Auto-completion
  "antdToken.enableCompletion": true, // Enable auto-completion
  "antdToken.completionDetailLevel": "normal", // "minimal" | "normal" | "detailed"
  "antdToken.showRecentTokensFirst": true, // Recently used tokens first
  "antdToken.maxRecentTokens": 10, // Number of recent tokens to keep
  "antdToken.enableCategoryGroups": false, // Group by category display (e.g. Color, Spacing)
  "antdToken.showCompletionIcons": true // Show color icons
}
```

## License

MIT
