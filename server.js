const express = require('express');
const { ChatOllama } = require("@langchain/ollama");
const { ChatPromptTemplate } = require("@langchain/core/prompts");
const { StringOutputParser } = require("@langchain/core/output_parsers");
const app = express();
const PORT = 3000;

app.use(express.json());
// 托管静态文件（前端页面）
app.use(express.static('public'));

// 1. 初始化本地模型
const llm = new ChatOllama({
  baseUrl: "http://localhost:11434",
  model: "qwen2.5:7b", // 确保和你本地模型名一致
  temperature: 1.5, // 调高随机性
  verbose: true,
});
// 2. 定义提示词模板
const prompt = ChatPromptTemplate.fromMessages([
  ["system", "你是一个参加博弈游戏的智体。规则：3人玩‘手心手背’，少数派获胜。"],
  ["user", "当前轮次随机因子: {random_num}。请从‘手心’或‘手背’中选一个。只允许回复这两个词之一，严禁解释。"]
]);
// 3. 构建 LangChain 链 (Chain)
const outputParser = new StringOutputParser();
const chain = prompt.pipe(llm).pipe(outputParser);
// 封装智体行为
async function getAgentResponse(name) {
    try {
        console.log(`智体 ${name} 正在思考...`);
        // 使用 LangChain 调用
        const response = await chain.invoke({
            random_num: Math.random().toString(36).substring(7)
        });
        
        const choice = response.trim();
        console.log(`智体 ${name} 选择: ${choice}`);
        return choice.includes("手心") ? "手心" : "手背";
    } catch (e) {
        console.error("LangChain 调用失败:", e);
        return Math.random() > 0.5 ? "手心" : "手背";
    }
}
app.get('/api/play', async (req, res) => {
    // 真正的多智体并行博弈
    const [a, b, c] = await Promise.all([
        getAgentResponse("A"),
        getAgentResponse("B"),
        getAgentResponse("C")
    ]);
    res.json({ a, b, c });
});

app.listen(PORT, () => console.log(`LangChain 服务运行在 http://localhost:${PORT}`));