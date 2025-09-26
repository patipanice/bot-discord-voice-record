import * as tf from "@tensorflow/tfjs";
import * as use from "@tensorflow-models/universal-sentence-encoder";

export const getSimilarText = async (userInputs: any[], taskNames: any[]) => {
  const model = await use.load();

  // รวมทั้งหมดในชุดเดียว
  const allSentences = [...userInputs, ...taskNames];
  const embeddings = await model.embed(allSentences);

  // แยก embedding ของ userInputs และ taskNames
  const userEmbeddings = embeddings.slice([0, 0], [userInputs.length, 512]);
  const taskEmbeddings = embeddings.slice(
    [userInputs.length, 0],
    [taskNames.length, 512]
  );

  // คำนวณ similarity matrix: [userInputs.length x taskNames.length]
  const similarityMatrix = tf.matMul(
    userEmbeddings,
    taskEmbeddings,
    false,
    true
  );

  const scores = (await similarityMatrix.array()) as number[][];

  //TODO: connect to BOT reply when someone talk
  scores.forEach((row, i) => {
    const bestMatchIndex = row.indexOf((Math.max(...row)));
    console.log(
      `"${userInputs[i]}" → "${taskNames[bestMatchIndex]}" (score: ${row[
        bestMatchIndex
      ].toFixed(3)})`
    );
  });
};
