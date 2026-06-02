// Ambient declaration for global CSS side-effect imports (e.g. `import "./globals.css"`).
// TypeScript 6.0 enables `noUncheckedSideEffectImports` by default, which errors on
// side-effect imports of modules that have no type declarations. The bundler (Next.js)
// handles the actual CSS at build time; this declaration only satisfies the type-checker.
// CSS Modules (`*.module.css`) keep their own typed declarations provided by Next.
declare module "*.css";
