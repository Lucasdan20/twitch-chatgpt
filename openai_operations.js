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

  async make_openai_call(text) {
    try {
      this.messages.push({ role: "user", content: text });
      this.check_history_length();

      console.log("🟢 Enviando para OpenAI:", text);
      let fullResponse = "";

      const response = await this.openai.responses.create({
        model: this.model_name,
        input: [
          {
            role: "user",
            content: [
              {
                type: "input_text",
                text: `${text}\n\nIMPORTANTE: Responda APENAS em português brasileiro, no tom da Jurema (natural, envolvente, divertida, humana). Se for muito longo, continue automaticamente sem pedir para continuar.`,
              },
            ],
          },
        ],
        temperature: 0.9,
        max_output_tokens: 1024,
      });

      console.log("🔍 Full API response:", JSON.stringify(response, null, 2));

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
        fullResponse = textParts.join("\n").trim();
      } else {
        fullResponse = "Sem resposta do modelo.";
      }

      // 🔁 Se o texto for muito longo, divide em até 3 blocos
      const maxBlockLength = 399;
      const blocks = fullResponse.match(new RegExp(`.{1,${maxBlockLength}}`, "g")) || [fullResponse];
      const limitedBlocks = blocks.slice(0, 3); // máximo de 3 blocos

      const finalResponse = limitedBlocks.join("\n");
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
