import OpenAI from "openai";

export class OpenAIOperations {
  constructor(file_context, openai_key, model_name, history_length) {
    this.messages = [{ role: "system", content: file_context }];
    this.openai = new OpenAI({ apiKey: openai_key });
    this.model_name = model_name;
    this.history_length = history_length;
  }

  check_history_length() {
    if (this.messages.length > this.history_length * 2 + 1) {
      this.messages.splice(1, 2);
    }
  }

  async make_openai_call(text, channelMode = "default") {
    try {
      this.messages.push({ role: "user", content: text });
      this.check_history_length();

      // 🎭 Mostra qual personalidade está ativa
      console.log(`🎭 Personality: ${channelMode === "bunny" ? "Bunny Mode 🐰" : channelMode === "biack" ? "Biack Mode 🧠" : "Default Mode"}`);

      console.log("🟢 Enviando para OpenAI:", text);
      let fullResponse = "";

      // Prompt dinâmico conforme o canal
      const personalityPrompt = {
        bunny: `
Você é a Jurema, chatbot da Bunny no canal "coelhodebaunilha".  
Fale de forma fofa, divertida, com emoção e naturalidade.  
Use emojis, gírias leves e carinho. Soe como uma amiga próxima, sem listas ou tópicos.
`,
        biack: `
Você é a Jurema, co-host do Biack no canal "biack_frost".  
Fale de forma sarcástica, natural, com humor inteligente e ironia leve.  
Evite respostas longas e técnicas — seja fluida, como em uma conversa.  
Sem usar listas, só um parágrafo natural.
`,
        default: `
Você é a Jurema, chatbot da Twitch.  
Fale com naturalidade e brevidade, como se estivesse em uma conversa real.  
Nunca use inglês, nem formate como lista ou tópicos.  
Finalize de forma natural.
`
      };

      const selectedPrompt = personalityPrompt[channelMode] || personalityPrompt.default;

      const response = await this.openai.responses.create({
        model: this.model_name,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `${selectedPrompt}\n\n${text}`,
              },
            ],
          },
        ],
        temperature: 0.9,
        max_output_tokens: 1024,
      });

      // 🧩 Extrai texto final
      if (response.output_text && response.output_text.trim() !== "") {
        fullResponse = response.output_text;
      } else if (response.output && response.output.length > 0) {
        const textParts = response.output
          .map((item) => {
            if (item.type === "output_text") return item.content?.[0]?.text;
            if (item.type === "reasoning") return item.summary?.join(" ");
            return null;
          })
          .filter(Boolean);
        fullResponse = textParts.join(" ").trim();
      } else {
        fullResponse = "Sem resposta do modelo.";
      }

      // 🧹 Remove qualquer coisa em inglês ou comandos internos
      fullResponse = fullResponse
        .split(/(?=Please|Any constraints|Once I have)/i)[0]
        .replace(/[-•]\s*/g, "") // remove traços e bullets
        .replace(/\b(?:Please|Once|paste|upload|file|constraints|describe|key points)\b.*$/i, "")
        .trim();

      // ✂️ Limita a 1200 caracteres
      const maxBlockLength = 1200;
      const blocks = fullResponse.match(new RegExp(`.{1,${maxBlockLength}}`, "g")) || [fullResponse];
      const finalResponse = blocks.slice(0, 1).join(" ").trim();

      console.log(`🤖 Agent Response: ${finalResponse}`);
      this.messages.push({ role: "assistant", content: finalResponse });
      return finalResponse;

    } catch (error) {
      console.error("❌ OpenAI error:", error);
      if (error.response) {
        console.error("🔻 Response status:", error.response.status);
        console.error("🔻 Response data:", JSON.stringify(error.response.data, null, 2));
      }
      return "Desculpe, algo deu errado. Tente novamente mais tarde.";
    }
  }
}
