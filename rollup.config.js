const resolve = require("@rollup/plugin-node-resolve").default;
const commonjs = require("@rollup/plugin-commonjs");
const typescript = require("@rollup/plugin-typescript");
const copy = require("rollup-plugin-copy");
const del = require("rollup-plugin-delete");

const dest = "./build";

module.exports = {
  input: "src/JoynScript.ts",
  output: {
    file: `${dest}/JoynScript.js`,
    format: "cjs",
    sourcemap: false,
  },
  plugins: [
    del({ targets: `${dest}/*` }),
    resolve(),
    commonjs(),
    typescript({ tsconfig: "./tsconfig.json" }),
    copy({
      targets: [
        { src: "JoynConfig.json", dest },
        { src: "assets/JoynIcon.png", dest: `${dest}` },
      ],
    }),
  ],
};
