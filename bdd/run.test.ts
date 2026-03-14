import { configure } from "@deepracticex/bdd";

await configure({
  features: ["bdd/features/**/*.feature"],
  steps: ["bdd/steps/**/*.ts", "bdd/support/**/*.ts"],
  timeout: 120_000,
});
