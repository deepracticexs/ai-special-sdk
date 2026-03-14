import { Given, When, Then, World, setWorldConstructor } from "@deepracticex/bdd";
import { autoRegister } from "../../src/client";
import { ingest } from "../../src/structify";
import { match } from "../../src/match";
import { expect } from "bun:test";
import type { MatchOutput } from "../../src/match";
import type { IWorldOptions } from "@deepracticex/bdd";

class MatchWorld extends World {
  result?: MatchOutput;
  error?: Error;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(MatchWorld);

Given("已有阿姨数据在库中", async function (this: MatchWorld) {
  autoRegister();

  // 导入测试数据（如果库里已有则跳过）
  try {
    const { search } = await import("../../src/structify");
    const existing = await search("测试", 1);
    if (existing.length > 0) {
      console.log("  数据库已有数据，跳过导入");
      return;
    }
  } catch {
    // 表不存在，需要导入
  }

  const testData = [
    { raw: "张阿姨今年48岁，做月嫂已经8年了。最拿手的就是月子餐，会做各种汤品和营养餐。之前在上海浦东几个高端月子会所干过，客户评价都很好。有母婴护理师证书和营养师证。性格温柔有耐心，特别会照顾产妇情绪。", source: "test" },
    { raw: "李姐35岁，保洁做了3年，主要在北京朝阳区活动。干活特别利索，收纳整理是强项。之前客户说她把家里收拾得跟样板间似的。没什么证书但是口碑特别好。人很爽快，守时靠谱。", source: "test" },
    { raw: "王大姐52岁，护工经验10年，在医院陪护过各种病人。会基本的医疗护理，量血压测血糖这些都没问题。有护理员证和急救证。人很细心，家属都很放心。住在上海虹口。", source: "test" },
  ];

  await ingest(testData, (event) => {
    console.log(`  [${event.step}] ${event.status}: ${event.message}`);
  });
});

When("用户需求是 {string}", async function (this: MatchWorld, query: string) {
  try {
    this.result = await match(query, (event) => {
      console.log(`  [${event.step}] ${event.status}: ${event.message}`);
    });
  } catch (err) {
    this.error = err as Error;
  }
});

Then("应该返回推荐结果并附带理由", function (this: MatchWorld) {
  if (this.error) throw this.error;
  expect(this.result).toBeDefined();
  expect(this.result!.results.length).toBeGreaterThan(0);

  console.log("\n  === 推荐结果 ===");
  for (const r of this.result!.results) {
    console.log(`  #${r.rank} ${r.name}（${r.score}分）`);
    console.log(`     理由：${r.reason}`);
  }
});

Then("第一名应该是张阿姨", function (this: MatchWorld) {
  expect(this.result!.results[0].name).toContain("张");
});

Then("每个推荐都应该有具体的理由", function (this: MatchWorld) {
  for (const r of this.result!.results) {
    expect(r.reason).toBeTruthy();
    expect(r.reason.length).toBeGreaterThan(10);
  }
});
