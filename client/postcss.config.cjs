module.exports = {
  plugins: [
    require('postcss-import'),
    // Open Brain (RTL, §14): keep logical properties logical. postcss-preset-env
    // polyfills them by rewriting to physical equivalents assuming LTR, so every
    // Tailwind `start-*`/`end-*`/`ms-*`/`text-start` utility compiled down to
    // `left`/`right`/`text-align:left` and pinned the UI to LTR — floating labels
    // sat on the wrong side under `dir=rtl`. Logical properties are baseline in
    // every browser we target, so the polyfill is all cost and no benefit.
    require('postcss-preset-env')({
      features: { 'logical-properties-and-values': false },
    }),
    require('tailwindcss'),
    require('autoprefixer'),
  ],
};
