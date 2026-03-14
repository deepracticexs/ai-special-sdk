import { Given, When, Then, World, setWorldConstructor } from "@deepracticex/bdd";
import { autoRegister } from "../../src/client";
import { ingest, search } from "../../src/structify";
import { expect } from "bun:test";
import type { AuntieProfile, SearchResult } from "../../src/structify";
import type { IWorldOptions } from "@deepracticex/bdd";

class StructifyWorld extends World {
  profiles: AuntieProfile[] = [];
  searchResults: SearchResult[] = [];
  error?: Error;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(StructifyWorld);

Given("文本服务已就绪", function (this: StructifyWorld) {
  autoRegister();
});

When("我导入以下阿姨数据:", async function (this: StructifyWorld, docString: string) {
  // 用 --- 分割成多条数据
  const rawItems = docString.split("---").map((s) => s.trim()).filter(Boolean);

  try {
    this.profiles = await ingest(
      rawItems.map((raw) => ({ raw, source: "bdd-test" })),
      (event) => {
        console.log(`  [${event.step}] ${event.status}: ${event.message}`);
      },
    );
  } catch (err) {
    this.error = err as Error;
  }
});

Then("应该成功导入 {int} 条记录", function (this: StructifyWorld, count: number) {
  if (this.error) throw this.error;
  expect(this.profiles.length).toBe(count);
  for (const p of this.profiles) {
    console.log(`  已导入: ${p.name} — ${p.text.slice(0, 60)}...`);
  }
});

When("我搜索 {string}", async function (this: StructifyWorld, query: string) {
  this.searchResults = await search(query, 3);
  console.log(`  搜索 "${query}" 结果:`);
  for (const r of this.searchResults) {
    console.log(`    - ${r.name} (距离: ${r.score.toFixed(4)})`);
  }
});

Then("搜索结果第一个应该是张阿姨", function (this: StructifyWorld) {
  expect(this.searchResults.length).toBeGreaterThan(0);
  expect(this.searchResults[0].name).toContain("张");
});

Then("搜索结果第一个应该是王大姐", function (this: StructifyWorld) {
  expect(this.searchResults.length).toBeGreaterThan(0);
  expect(this.searchResults[0].name).toContain("王");
});
