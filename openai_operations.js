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
      `Conversations in History: ${((this.messages.length / 2) - 1)}/${this.history_length}`
    );
    if (this.messages.length > this.history_length * 2 + 1) {
      console.log("Message amount in history exceeded. Removing oldest messages.");
      this.messages.splice(1, 2);
    }
  }

  // =======================================================================
  // 🚀 PRINCIPAL — chamada GPT (usado pelo !gpt)
  // =======================================================================
  async make_openai_call(text) {
    try {
      this.messages.push({ role: "user", content: text });
      this.check_history_length();

      let agent_response = "";
      console.log("🟢 Enviando para OpenAI:", text);

      if (
        this.model_name.startsWith("gpt-5") ||
        this.model_name.startsWith("gpt-4.1") ||
        this.model_name.startsWith("gpt-4o")
      ) {
        let iteration = 0;
        let full_output = [];
        let incomplete = true;

        while (incomplete && iteration < 5) {
          iteration++;
          console.log(`⚙️ Gerando parte ${iteration} da resposta...`);

          const response = await this.openai.responses.create({
            model: this.model_name,
            input: [
              {
                role: "user",
                content: [
                  { type: "input_text", text: iteration === 1 ? text : "continue" }
                ]
              }
            ],
            temperature: 1,
            max_output_tokens: 1024,
          });

          console.log(`📦 Parte ${iteration} status: ${response.status}`);

          if (response.output) {
            full_output.push(...response.output);
          }

          incomplete =
            response.status === "incomplete" &&
            response.incomplete_details?.reason === "max_output_tokens";

          if (!incomplete) console.log(`✅ Parte ${iteration} concluída.`);
        }

        // 🔹 Extrai o texto consolidado
        const textParts = [];
        for (const item of full_output) {
          if (item.type === "output_text" && item.content?.length) {
            for (const chunk of item.content) {
              if (chunk.text) textParts.push(chunk.text);
            }
          } else if (item.type === "message" && item.content?.length) {
            for (const chunk of item.content) {
              if (chunk.text) textParts.push(chunk.text);
            }
          } else if (item.type === "reasoning" && item.summary?.length) {
            textParts.push(item.summary.join(" "));
          }
        }

        agent_response = textParts.join(" ").trim() || "Sem resposta do modelo.";

      } else {
        // ==============================================================
        // GPT-3.5 ou anterior
        // ==============================================================
        const response = await this.openai.chat.completions.create({
          model: this.model_name,
          messages: this.messages,
          temperature: 1,
          max_tokens: 1024,
          top_p: 1,
          frequency_penalty: 0,
          presence_penalty: 0,
        });

        agent_response =
          response.choices?.[0]?.message?.content || "Sem resposta do modelo.";
      }

      console.log(`🤖 Agent Response: ${agent_response}`);
      this.messages.push({ role: "assistant", content: agent_response });

      if (typeof agent_response !== "string") {
        agent_response = JSON.stringify(agent_response);
      }

      return agent_response;

    } catch (error) {
      console.error("❌ OpenAI error:", error);
      if (error.response) {
        console.error("🔻 Response status:", error.response.status);
        console.error("🔻 Response data:", JSON.stringify(error.response.data, null, 2));
      }
      return "Desculpe, algo deu errado. Tente novamente 💜";
    }
  }

  // =======================================================================
  // ✏️ Modo PROMPT
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

      const agent_response =
        response.choices?.[0]?.text?.trim() || "Sem resposta do modelo.";

      console.log(`Agent Response: ${agent_response}`);
      return agent_response;
    } catch (error) {
      console.error("❌ OpenAI error:", error);
      if (error.response) {
        console.error("🔻 Response status:", error.response.status);
        console.error("🔻 Response data:", JSON.stringify(error.response.data, null, 2));
      }
      return "Desculpe, algo deu errado. Tente novamente 💜";
    }
  }
}
