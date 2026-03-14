import { Given, When, Then, World, setWorldConstructor, DataTable } from "@deepracticex/bdd";
import { autoRegister } from "../../src/client";
import { recruit } from "../../src/recruit";
import { expect } from "bun:test";
import type { RecruitInput, RecruitOutput, ProgressEvent } from "../../src/types";
import type { IWorldOptions } from "@deepracticex/bdd";

class RecruitWorld extends World {
  result?: RecruitOutput;
  events: ProgressEvent[] = [];
  error?: Error;

  constructor(options: IWorldOptions) {
    super(options);
  }
}

setWorldConstructor(RecruitWorld);

Given("文本和图片生成服务已就绪", function (this: RecruitWorld) {
  autoRegister();
});

When("我请求生成招募内容:", async function (this: RecruitWorld, dataTable: DataTable) {
  const data = dataTable.rowsHash();

  const input: RecruitInput = {
    position: data.position,
    region: data.region,
    salary: data.salary,
    contact: data.contact,
    platform: data.platform,
  };

  try {
    this.result = await recruit(input, (event) => {
      this.events.push(event);
      console.log(`  [${event.step}] ${event.status}: ${event.message}`);
    });
  } catch (err) {
    this.error = err as Error;
  }
});

Then("应该返回文案和海报", function (this: RecruitWorld) {
  if (this.error) throw this.error;
  expect(this.result).toBeDefined();

  // 文案
  expect(this.result!.copy).not.toBeNull();
  expect(this.result!.copy!.title).toBeTruthy();
  expect(this.result!.copy!.content).toBeTruthy();
  console.log("\n  === 结果 ===");
  console.log("  文案标题:", this.result!.copy!.title);
  console.log("  标签:", this.result!.copy!.hashtags?.join(" "));

  // 提示词
  expect(this.result!.imagePrompt).toBeTruthy();
  console.log("  图片提示词:", this.result!.imagePrompt!.slice(0, 100) + "...");

  // 海报
  expect(this.result!.imageUrl).not.toBeNull();
  expect(this.result!.imageUrl).toMatch(/^https?:\/\//);
  console.log("  海报 URL:", this.result!.imageUrl);
});

Then("进度事件应该按三步依次触发", function (this: RecruitWorld) {
  const steps = this.events.map((e) => `${e.step}:${e.status}`);

  // 三步都有 running
  expect(steps).toContain("文案生成:running");
  expect(steps).toContain("海报生成:running");

  // 文案完成在提示词之前，提示词完成在海报之前
  const copyDone = this.events.findIndex((e) => e.step === "文案生成" && e.status === "done");
  const posterStart = this.events.findIndex((e) => e.step === "海报生成" && e.status === "running");
  expect(copyDone).toBeLessThan(posterStart);
});
