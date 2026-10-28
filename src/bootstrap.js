import("./main.js").catch((error) => {
  console.error(error);
  const root = document.getElementById("root");
  const message = document.createElement("p");
  message.setAttribute("role", "alert");
  message.textContent = "Pond could not load / 主题加载失败：" + error.message;
  root.replaceChildren(message);
});
