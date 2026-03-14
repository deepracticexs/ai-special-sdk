import { Given, When, Then } from "@deepracticex/bdd";
import { autoRegister } from "../../src/client";
import { recruitAsync, getTask, addCustomStep, completeCustomStep } from "../../src/async";
import { expect } from "bun:test";
import type { Task } from "../../src/task";

Given("服务已就绪", function (this: any) {
  autoRegister();
  this.taskIds = [];
  this.completedTasks = [];
});

When("我同时发起 {int} 个招募任务", async function (this: any, count: number) {
  const platforms = ["小红书", "朋友圈"];

  for (let i = 0; i < count; i++) {
    const taskId = recruitAsync({
      position: "月嫂",
      region: "上海",
      salary: "8000-15000元/月",
      contact: "13800138000",
      platform: platforms[i],
    });
    this.taskIds.push(taskId);
    console.log(`  任务 ${i + 1} 已发起: ${taskId}`);
  }

  // 等待所有任务完成
  await Promise.all(
    this.taskIds.map(
      (id) =>
        new Promise<void>((resolve) => {
          const check = () => {
            const task = getTask(id);
            if (task && (task.status === "done" || task.status === "error")) {
              this.completedTasks.push(task);
              resolve();
            } else {
              setTimeout(check, 500);
            }
          };
          check();
        }),
    ),
  );
});

Then("应该立即返回 {int} 个不同的 taskId", function (this: any, count: number) {
  expect(this.taskIds.length).toBe(count);
  expect(new Set(this.taskIds).size).toBe(count);
});

Then("等待完成后每个任务都有结果", function (this: any) {
  for (const task of this.completedTasks) {
    console.log(`  任务 ${task.id}: ${task.status}`);
    if (task.status === "done" && task.result) {
      const result = task.result as { copy?: { title?: string }; imageUrl?: string };
      console.log(`    文案: ${result.copy?.title?.slice(0, 30)}...`);
      console.log(`    海报: ${result.imageUrl}`);
    }
  }
  expect(this.completedTasks.length).toBe(this.taskIds.length);
});

Then("每个任务都有完整的步骤记录", function (this: any) {
  for (const task of this.completedTasks) {
    console.log(`  任务 ${task.id} 步骤:`);
    for (const step of task.steps) {
      const duration = step.completedAt && step.startedAt ? `${((step.completedAt - step.startedAt) / 1000).toFixed(1)}s` : "...";
      console.log(`    [${step.name}] ${step.status} (${duration}): ${step.message}`);
    }
    // 至少有文案生成和海报生成步骤
    const stepNames = task.steps.map((s) => s.name);
    expect(stepNames).toContain("文案生成");
    expect(stepNames).toContain("海报生成");
  }
});

When("我发起一个招募任务并添加自定义步骤", async function (this: any) {
  const taskId = recruitAsync({
    position: "保洁",
    region: "北京",
    salary: "5000-8000元/月",
    contact: "13900139000",
    platform: "抖音",
  });
  this.taskIds.push(taskId);

  // 添加自定义步骤
  addCustomStep(taskId, "风格优化", "正在根据抖音风格优化排版...");
  setTimeout(() => {
    completeCustomStep(taskId, "风格优化", "排版优化完成");
  }, 1000);

  // 等待任务完成
  await new Promise<void>((resolve) => {
    const check = () => {
      const task = getTask(taskId);
      if (task && (task.status === "done" || task.status === "error")) {
        this.completedTasks.push(task);
        resolve();
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
});

Then("任务的步骤中应该包含自定义步骤", function (this: any) {
  const task = this.completedTasks[0];
  const stepNames = task.steps.map((s) => s.name);
  console.log("  所有步骤:", stepNames.join(" → "));
  expect(stepNames).toContain("风格优化");
});
