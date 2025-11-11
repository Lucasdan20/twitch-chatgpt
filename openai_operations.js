// Importa o SDK oficial da OpenAI
import OpenAI from "openai";

export class OpenAIOperations {
  constructor(file_context, openai_key, model_name, history_length) {
    this.messages = [{ role: "system", content: file_context }];
    this.openai = new OpenAI({ apiKey: openai_key });
    this.model_name = model_name;
    this.history_length = history_length;
  }

  check_history_length() {
    console.log(
      `🧾 Histórico: ${((this.messages.length / 2) - 1)}/${this.history_length}`
    );
    if (this.messages.length > this.history_length * 2 + 1) {
      console.log("🧹 Histórico cheio, removendo mensagens antigas...");
      this.messages.splice(1, 2);
    }
  }

  // =======================================================================
  // 🚀 PRINCIPAL — chamada GPT (usado pelo !gpt)
  // =======================================================================
  async make_openai_call(text) {
    try {
      // Adiciona mensagem do usuário
      this.messages.push({ role: "user", content: text });
      this.check_history_length();

      console.log("🟢 Enviando para OpenAI:", text);

      // Instrução extra para manter o estilo e idioma
      const style_reinforcement = `
Fale APENAS em português brasileiro.
Responda no tom da Jurema: divertida, carismática, debochada, natural e envolvente.
Seja humana e espontânea — nunca pareça um robô.
`;

      let agent_response = "";

      // ==============================================================
      // GPT-4.1 / GPT-5 / GPT-4o — novo endpoint
      // ==============================================================
      if (
        this.model_name.startsWith("gpt-5") ||
        this.model_name.startsWith("gpt-4.1") ||
        this.model_name.startsWith("gpt-4o")
      ) {
        const response = await this.openai.responses.create({
          model: this.model_name,
          input: [
            {
              role: "system",
              content: [
                { type: "input_text", text: style_reinforcement }
              ]
            },
            {
              role: "user",
              content: [
                { type: "input_text", text: text }
              ]
            }
          ],
          temperature: 1,
          max_output_tokens: 2048, // maior para evitar corte
        });

        console.log("🔍 Full API response:", JSON.stringify(response, null, 2));

        // Captura resposta completa
        if (response.output_text && response.output_text.trim() !== "") {
          agent_response = response.output_text.trim();
        } else if (response.output && response.output.length > 0) {
          const textParts = response.output
            .map((item) => {
              if (item.type === "output_text") return item.content?.[0]?.text;
              if (item.type === "reasoning") return item.summary?.join(" ");
              return null;
            })
            .filter(Boolean);
          agent_response = textParts.join("\n").trim();
        } else {
          agent_response = "Sem resposta do modelo.";
        }

      // ==============================================================
      // GPT-3.5 ou versões antigas
      // ==============================================================
      } else {
        const response = await this.openai.chat.completions.create({
          model: this.model_name,
          messages: [
            { role: "system", content: `${style_reinforcement}\n${this.messages[0].content}` },
            ...this.messages.slice(1),
          ],
          temperature: 1,
          max_tokens: 1024,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        });

        agent_response =
          response.choices?.[0]?.message?.content || "Sem resposta do modelo.";
      }

      console.log(`🤖 Resposta da Jurema: ${agent_response}`);

      this.messages.push({ role: "assistant", content: agent_response });

      // Garante tipo string
      if (typeof agent_response !== "string") {
        agent_response = JSON.stringify(agent_response);
      }

      return agent_response;

    } catch (error) {
      console.error("❌ Erro OpenAI:", error);
      if (error.response) {
        console.error("🔻 Status:", error.response.status);
        console.error("🔻 Data:", JSON.stringify(error.response.data, null, 2));
      }
      return "A Jurema ficou confusa por um instante 😵‍💫 Tenta de novo rapidinho!";
    }
  }

  // =======================================================================
  // ✏️ Modo PROMPT (usado se GPT_MODE = PROMPT)
  // =======================================================================
  async make_openai_call_completion(text) {
    try {
      const response = await this.openai.completions.create({
        model: "text-davinci-003",
        prompt: text,
        temperature: 1,
        max_tokens: 1024,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0,
      });

      let agent_response = response.choices?.[0]?.text || "Sem resposta do modelo.";
      console.log(`🧠 Agent Response: ${agent_response}`);
      return agent_response;
    } catch (error) {
      console.error("❌ Erro OpenAI:", error);
      if (error.response) {
        console.error("🔻 Status:", error.response.status);
        console.error("🔻 Data:", JSON.stringify(error.response.data, null, 2));
      }
      return "A Jurema bugou rapidinho, tenta outra vez 💫";
    }
  }
}
