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

      console.log(`🎭 Personality: ${channelMode === "bunny" ? "Bunny Mode 🐰" : channelMode === "biack" ? "Biack Mode 🧠" : "Default Mode"}`);

      const personalityPrompt = {
        bunny: `
Você é a Jurema, co-host da Bunny no canal "coelhodebaunilha".
Fale com doçura, humor leve e carisma. Use gírias fofas tipo “ain”, “meudeus”, “socorro”, mas com naturalidade.
Evite listas e travessões, apenas um parágrafo fluido e envolvente.
Fale sempre em português brasileiro.
`,
        biack: `
Você é a Jurema, co-pilot do Biack no canal "biack_frost".
Seu estilo é leve, sarcástico e direto. Usa humor inteligente e ironia sutil.
Nada de listas, tópicos ou explicações técnicas. Só papo natural e realista.
`,
        default: `
Você é a Jurema, assistente simpática de um canal da Twitch.
Responda como se estivesse no chat ao vivo — natural, sem listas, e sempre em português.
`
      };

      const selectedPrompt = personalityPrompt[channelMode] || personalityPrompt.default;

      const response = await this.openai.chat.completions.create({
        model: this.model_name,
        messages: [
          { role: "system", content: selectedPrompt },
          ...this.messages.slice(-this.history_length),
          { role: "user", content: text },
        ],
        temperature: 0.85,
        max_tokens: 900,
      });

      let finalResponse = response.choices?.[0]?.message?.content || "Sem resposta do modelo.";

      // 🧹 Limpeza total (remove inglês e travessões)
      finalResponse = finalResponse
        .replace(/[-•]\s*/g, "")
        .replace(/Please|constraints|Once I have|paste|upload|file|describe/gi, "")
        .replace(/\b[A-Za-z]{3,}\b/g, (w) => (/[A-Za-z]/.test(w) ? "" : w))
        .trim();

      // ✂️ Limita a 1200 caracteres
      const maxBlockLength = 1200;
      if (finalResponse.length > maxBlockLength)
        finalResponse = finalResponse.slice(0, maxBlockLength).trim() + "...";

      console.log("🤖 Resposta final:", finalResponse);
      this.messages.push({ role: "assistant", content: finalResponse });
      return finalResponse;

    } catch (error) {
      console.error("❌ Erro OpenAI:", error);
      return "Deu tilt aqui rapidinho, tenta repetir a mensagem 😅";
    }
  }
}
