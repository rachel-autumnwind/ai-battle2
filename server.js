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
  ["system", "你是一个参加博弈游戏的智体。规则：3人玩'手心手背'，少数派获胜。你需要随机选择，避免被预测。"],
  ["user", "随机种子: {random_num}。\n\n请立即从以下两个选项中随机选一个：\n1. 手心\n2. 手背\n\n你的回复必须只包含'手心'或'手背'这4个字，不要有任何其他内容。"]
]);
// 3. 构建 LangChain 链 (Chain)
const outputParser = new StringOutputParser();
const chain = prompt.pipe(llm).pipe(outputParser);
// 封装智体行为
async function getAgentResponse(name) {
    try {
        console.log(`智体 ${name} 正在思考...`);

        // 为每个智体生成不同的随机种子，增加多样性
        const randomSeed = Math.random();
        const randomHint = randomSeed > 0.5 ? "大多数人会选手心" : "大多数人会选手背";

        // 使用 LangChain 调用
        const response = await chain.invoke({
            random_num: `${Math.random().toString(36).substring(2)} - 提示: ${randomHint}`
        });

        const rawResponse = response.trim();
        console.log(`智体 ${name} 原始回复: ${rawResponse}`);

        let aiChoice;
        let parseMethod;

        // 解析AI的选择
        if (rawResponse.includes("手心")) {
            aiChoice = "手心";
            parseMethod = "包含'手心'";
        } else if (rawResponse.includes("手背")) {
            aiChoice = "手背";
            parseMethod = "包含'手背'";
        } else {
            aiChoice = Math.random() > 0.5 ? "手心" : "手背";
            parseMethod = "无法识别，随机选择";
        }

        // 强制随机化：30%概率翻转AI的选择，避免模型偏好导致的单一结果
        const flipRandom = Math.random();
        let finalChoice = aiChoice;
        let flipped = false;

        if (flipRandom < 0.3) {
            finalChoice = aiChoice === "手心" ? "手背" : "手心";
            flipped = true;
        }

        const finalParseMethod = flipped
            ? `${parseMethod} → 随机翻转(${(flipRandom * 100).toFixed(0)}%<30%)`
            : `${parseMethod} → 保持(${(flipRandom * 100).toFixed(0)}%>=30%)`;

        console.log(`智体 ${name} 最终选择: ${finalChoice} (${finalParseMethod})`);

        return {
            choice: finalChoice,
            rawResponse: rawResponse,
            parseMethod: finalParseMethod
        };
    } catch (e) {
        console.error("LangChain 调用失败:", e);
        const fallbackChoice = Math.random() > 0.5 ? "手心" : "手背";
        return {
            choice: fallbackChoice,
            rawResponse: `错误: ${e.message}`,
            parseMethod: "异常回退"
        };
    }
}
app.get('/api/play', async (req, res) => {
    // 真正的多智体并行博弈
    const [agentA, agentB, agentC] = await Promise.all([
        getAgentResponse("A"),
        getAgentResponse("B"),
        getAgentResponse("C")
    ]);

    res.json({
        a: agentA.choice,
        b: agentB.choice,
        c: agentC.choice,
        details: {
            agentA: {
                choice: agentA.choice,
                rawResponse: agentA.rawResponse,
                parseMethod: agentA.parseMethod
            },
            agentB: {
                choice: agentB.choice,
                rawResponse: agentB.rawResponse,
                parseMethod: agentB.parseMethod
            },
            
            agentC: {
                choice: agentC.choice,
                rawResponse: agentC.rawResponse,
                parseMethod: agentC.parseMethod
            }
        }
    });
});

app.listen(PORT, () => console.log(`LangChain 服务运行在 http://localhost:${PORT}`));