(function () {
  var SHARE_TEXT = "דני פיק\nDanny Pick\n052-375155\ndanny@pdpsagot.co.il";

  document.querySelectorAll(".js-save-contact").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      var base = this.getAttribute("href").split("?")[0];
      window.location.assign(base + "?v=" + Date.now());
    });
  });

  function bgUrl() {
    var root = document.querySelector(".danny-pik-vcard");
    var raw = root ? getComputedStyle(root).getPropertyValue("--card-bg-url") : "";
    raw = (raw || "").trim().replace(/^url\((.*)\)$/i, "$1").replace(/^["']|["']$/g, "");
    return raw || "/idcard/card-bg.png";
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () {
        resolve(img);
      };
      img.onerror = reject;
      img.src = src;
    });
  }

  async function cardFile() {
    if (document.fonts && document.fonts.load) {
      await document.fonts.load("800 72px Heebo");
      await document.fonts.load("500 28px Heebo");
    }
    var img = await loadImage(bgUrl());
    var canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 676;
    var ctx = canvas.getContext("2d");
    var scale = Math.max(canvas.width / img.width, canvas.height / img.height);
    var w = img.width * scale;
    var h = img.height * scale;
    ctx.drawImage(img, (canvas.width - w) / 2, (canvas.height - h) / 2, w, h);
    ctx.fillStyle = "#0f4c81";
    ctx.textAlign = "right";
    ctx.direction = "rtl";
    ctx.font = "800 72px Heebo, sans-serif";
    ctx.fillText("דני פיק", 1140, 210);
    ctx.fillStyle = "#c4a574";
    ctx.fillRect(1068, 236, 72, 3);
    ctx.fillStyle = "#2a6a9b";
    ctx.font = "500 28px Heebo, sans-serif";
    ctx.direction = "ltr";
    ctx.fillText("Danny Pick", 1140, 290);
    ctx.fillStyle = "#0f4c81";
    ctx.font = "600 32px Heebo, sans-serif";
    ctx.fillText("052-375155", 1140, 390);
    ctx.fillText("danny@pdpsagot.co.il", 1140, 450);
    var blob = await new Promise(function (resolve) {
      canvas.toBlob(resolve, "image/jpeg", 0.9);
    });
    return new File([blob], "danny-pik.jpg", { type: "image/jpeg" });
  }

  document.querySelectorAll(".js-share-card").forEach(function (link) {
    link.addEventListener("click", async function (event) {
      event.preventDefault();
      var file = null;
      try {
        file = await cardFile();
      } catch (err) {
        file = null;
      }
      var payload = { title: "דני פיק", text: SHARE_TEXT, files: file ? [file] : undefined };
      if (file && navigator.canShare && navigator.canShare(payload)) {
        try {
          await navigator.share(payload);
          return;
        } catch (err) {
          if (err && err.name === "AbortError") return;
        }
      }
      window.open(
        "https://wa.me/972523795155?text=" + encodeURIComponent(SHARE_TEXT),
        "_blank",
        "noopener"
      );
    });
  });
})();
