# Graph Report - E-Commercial_market_place_TBD-  (2026-11-03)

## Corpus Check
- Corpus is ~36,183 words - fits in a single context window. You may not need a graph.

## Summary
- 466 nodes · 799 edges · 92 communities (19 shown, 73 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Marketplace Data Types
- Shared UI Contracts
- Account and Admin Logic
- Marketplace Screens and Entities
- Expo App Configuration
- Authentication UI
- Runtime Dependencies
- Mobile Dependencies
- Login Flow
- Lint and Typecheck Tooling
- Account Management
- Voucher Management
- App Startup and Navigation
- Expo Development Guidance
- Review Management
- Commit Conventions
- TypeScript Configuration
- Project Scripts
- Metro Bundler Configuration
- Expo Constants
- Cryptographic Utilities
- Deep Linking
- SQLite Storage
- Vector Icons
- Web Browser Integration
- Android Icon Background
- Android Logo Foreground
- Monochrome Android Logo
- App Favicon Logo
- Password Visibility Icon
- Plus Action Icon
- Shopping Bag Icon
- App Icon Artwork
- Splash Screen Artwork

## God Nodes (most connected - your core abstractions)
1. `react-native` - 50 edges
2. `react` - 33 edges
3. `expo-router` - 31 edges
4. `expo-symbols` - 18 edges
5. `formatCurrency()` - 17 edges
6. `colors` - 14 edges
7. `expo` - 13 edges
8. `expo-status-bar` - 13 edges
9. `react-native-safe-area-context` - 13 edges
10. `Text()` - 12 edges

## Surprising Connections (you probably didn't know these)
- `Screen()` --calls--> `ForgotPasswordScreen()`  [EXTRACTED]
  app/(auth)/forgot-password.tsx → src/components/auth/AuthScreens.tsx
- `Screen()` --calls--> `RegisterScreen()`  [EXTRACTED]
  app/(auth)/register.tsx → src/components/auth/AuthScreens.tsx
- `HomeScreen()` --calls--> `useCart()`  [EXTRACTED]
  app/(tabs)/home.tsx → src/store/marketplaceStore.ts
- `NotFoundScreen()` --calls--> `Text()`  [EXTRACTED]
  app/+not-found.tsx → components/Themed.tsx
- `RootLayoutNav()` --calls--> `useColorScheme()`  [EXTRACTED]
  app/_layout.tsx → components/useColorScheme.ts

## Import Cycles
- None detected.

## Communities (92 total, 73 thin omitted)

### Community 0 - "Marketplace Data Types"
Cohesion: 0.06
Nodes (58): CartScreen(), styles, FeedbackScreen(), QUICK_TAGS, RATING_LABELS, styles, FilterTab, OrderDetailScreen() (+50 more)

### Community 1 - "Shared UI Contracts"
Cohesion: 0.07
Nodes (18): ModalScreen(), styles, NotFoundScreen(), styles, styles, TabTwoScreen(), EditScreenInfo(), styles (+10 more)

### Community 2 - "Account and Admin Logic"
Cohesion: 0.05
Nodes (25): Account, AccountDetailScreen(), formatLabel(), formatValue(), getRole(), hiddenField(), styles, CATEGORIES (+17 more)

### Community 3 - "Marketplace Screens and Entities"
Cohesion: 0.12
Nodes (33): EditProfileScreen(), Field(), styles, AccountScreen(), Profile, styles, Banner, Category (+25 more)

### Community 4 - "Expo App Configuration"
Cohesion: 0.08
Nodes (24): backgroundColor, backgroundImage, foregroundImage, monochromeImage, adaptiveIcon, predictiveBackGestureEnabled, typedRoutes, expo (+16 more)

### Community 5 - "Authentication UI"
Cohesion: 0.24
Nodes (14): Screen(), Screen(), AuthField(), AuthPage(), AuthPageProps, BrandMark(), colors, FieldProps (+6 more)

### Community 6 - "Runtime Dependencies"
Cohesion: 0.12
Nodes (16): dependencies, expo-status-bar@~58.0.4, expo-symbols@~58.0.4, react@19.3.0, react-dom@19.3.0, react-native@0.88.0, react-native-safe-area-context@~5.10.1, react-native-screens@~4.30.0 (+8 more)

### Community 7 - "Mobile Dependencies"
Cohesion: 0.15
Nodes (12): react-native-svg@15.16.0, react-native-svg-transformer@^1.5.3, react-native-web@~0.21.4, react-native-worklets@0.13.0, main, name, private, version (+4 more)

### Community 8 - "Login Flow"
Cohesion: 0.21
Nodes (6): IndexScreen(), colors, LoginScreen(), SocialProvider, styles, signInWithEmail()

### Community 9 - "Lint and Typecheck Tooling"
Cohesion: 0.18
Nodes (11): { defineConfig }, expoConfig, devDependencies, eslint@^9.0.0, eslint-config-expo@~58.0.4, @types/react@~19.3.0, typescript@~6.0.3, eslint (+3 more)

### Community 10 - "Account Management"
Cohesion: 0.44
Nodes (9): Account, AccountListScreen(), getEmail(), getId(), getName(), getPhone(), getRole(), getValue() (+1 more)

### Community 11 - "Voucher Management"
Cohesion: 0.24
Nodes (9): COLORS, FILTERS, FilterType, formatCurrency(), INITIAL_VOUCHERS, isExpired(), styles, Voucher (+1 more)

### Community 12 - "App Startup and Navigation"
Cohesion: 0.22
Nodes (9): RootLayout(), RootLayoutNav(), unstable_settings, expo-font@~58.0.10, expo-splash-screen@~58.0.11, react-native-reanimated@4.7.1, expo-font, expo-splash-screen (+1 more)

### Community 13 - "Expo Development Guidance"
Cohesion: 0.25
Nodes (7): Continuous Native Generation, EAS Build and Updates, Expo Development Builds, Expo and React Native Mobile Application, Expo Router Navigation, Expo SDK Versioned Documentation, Recommended Expo Modules

### Community 14 - "Review Management"
Cohesion: 0.33
Nodes (6): FilterType, INITIAL_REVIEWS, Review, ReviewsScreen(), styles, TabItem()

### Community 15 - "Commit Conventions"
Cohesion: 0.29
Nodes (6): Breaking Change Notation, Commit Body and Issue References, Commit Scope Taxonomy, Commit Type Taxonomy, Conventional Commits, Marketplace Project Commit Convention

### Community 16 - "TypeScript Configuration"
Cohesion: 0.29
Nodes (6): expo/tsconfig.base, compilerOptions, paths, strict, extends, include

### Community 17 - "Project Scripts"
Cohesion: 0.33
Nodes (6): scripts, android, ios, lint, start, web

### Community 18 - "Metro Bundler Configuration"
Cohesion: 0.40
Nodes (4): config, { getDefaultConfig }, expo@~58.0.19, expo

## Knowledge Gaps
- **21 isolated node(s):** `expo/tsconfig.base`, `Expo SDK Versioned Documentation`, `Expo Router Navigation`, `EAS Build and Updates`, `Continuous Native Generation` (+16 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 236 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **73 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `react-native` connect `Shared UI Contracts` to `Marketplace Data Types`, `Account and Admin Logic`, `Marketplace Screens and Entities`, `Authentication UI`, `Runtime Dependencies`, `Mobile Dependencies`, `Login Flow`, `Account Management`, `Voucher Management`, `Review Management`?**
  _High betweenness centrality (0.220) - this node is a cross-community bridge._
- **What connects `expo/tsconfig.base`, `Expo SDK Versioned Documentation`, `Expo Router Navigation` to the rest of the system?**
  _21 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Marketplace Data Types` be split into smaller, more focused modules?**
  _Cohesion score 0.06265432098765432 - nodes in this community are weakly interconnected._
- **Why does `react` connect `Account and Admin Logic` to `Marketplace Data Types`, `Shared UI Contracts`, `Marketplace Screens and Entities`, `Authentication UI`, `Runtime Dependencies`, `Mobile Dependencies`, `Login Flow`, `Account Management`, `Voucher Management`, `App Startup and Navigation`, `Review Management`?**
  _High betweenness centrality (0.112) - this node is a cross-community bridge._
- **Should `Shared UI Contracts` be split into smaller, more focused modules?**
  _Cohesion score 0.07227891156462585 - nodes in this community are weakly interconnected._
- **Why does `expo-router` connect `Account and Admin Logic` to `Marketplace Data Types`, `Shared UI Contracts`, `Marketplace Screens and Entities`, `Authentication UI`, `Mobile Dependencies`, `Login Flow`, `Account Management`, `Voucher Management`, `App Startup and Navigation`?**
  _High betweenness centrality (0.085) - this node is a cross-community bridge._
- **Should `Account and Admin Logic` be split into smaller, more focused modules?**
  _Cohesion score 0.05314009661835749 - nodes in this community are weakly interconnected._