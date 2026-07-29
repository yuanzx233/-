import type { Metadata } from "next";
import { chatGPTSignInPath, getChatGPTUser } from "../chatgpt-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "登录 | 筑想家",
  description: "登录后管理你的自建房概念方案项目。",
};

export default async function LoginPage() {
  const user = await getChatGPTUser();

  return (
    <main className="login-shell">
      <section className="login-card">
        <a className="brand centered" href="/">
          <span className="brand-mark">筑</span>
          <span><strong>筑想家</strong><small>自建房智能方案</small></span>
        </a>
        <p className="eyebrow">项目空间</p>
        <h1>{user ? `欢迎回来，${user.displayName}` : "登录后继续你的方案"}</h1>
        <p>项目、场地文件和生成记录将与你的账号关联，并通过版本链保持一致。</p>
        {user ? (
          <a className="submit-button block-link" href="/">进入项目工作台</a>
        ) : (
          <a className="submit-button block-link" href={chatGPTSignInPath("/")}>
            使用 ChatGPT 登录
          </a>
        )}
        <a className="text-link back-link" href="/">先查看演示工作台</a>
      </section>
    </main>
  );
}
