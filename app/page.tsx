import type { Metadata } from "next";
import { getChatGPTUser } from "./chatgpt-auth";
import { ProjectDashboard } from "./project-dashboard";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "项目工作台 | 筑想家",
  description: "创建项目、上传地块 DXF，并跟踪自建房概念方案生成进度。",
};

export default async function Home() {
  const user = await getChatGPTUser();

  return (
    <ProjectDashboard
      user={
        user
          ? { name: user.displayName, email: user.email, authenticated: true }
          : { name: "演示设计师", email: "demo@local", authenticated: false }
      }
    />
  );
}
