(function () {
  var VCARD_URL = "https://pdpsagot.co.il/wp-content/uploads/danny-pik.vcf";

  function shareText() {
    return (
      "דני פיק\n" +
      "052-3795155\n" +
      "danny@pdpsagot.co.il\n\n" +
      "שמירה באנשי קשר:\n" +
      VCARD_URL
    );
  }

  function openWhatsAppText(text) {
    var url = "https://wa.me/?text=" + encodeURIComponent(text);
    try {
      if (window.top && window.top !== window) {
        window.top.location.href = url;
        return;
      }
    } catch (err) {}
    window.location.href = url;
  }

  function whenBackFromShare() {
    return new Promise(function (resolve) {
      var sawHidden = document.visibilityState === "hidden";
      var settled = false;
      var earlyTimer = 0;
      function finish() {
        if (settled) return;
        settled = true;
        document.removeEventListener("visibilitychange", onChange);
        window.clearTimeout(earlyTimer);
        window.setTimeout(resolve, 200);
      }
      function onChange() {
        if (document.visibilityState === "hidden") {
          sawHidden = true;
          window.clearTimeout(earlyTimer);
          return;
        }
        if (sawHidden) finish();
      }
      document.addEventListener("visibilitychange", onChange);
      earlyTimer = window.setTimeout(function () {
        if (!sawHidden && document.visibilityState === "visible") finish();
      }, 800);
    });
  }

  function pinShareButton() {
    document.querySelectorAll(".share-dock").forEach(function (dock) {
      dock.style.setProperty("position", "relative", "important");
      dock.style.setProperty("width", "46%", "important");
      dock.style.setProperty("margin-left", "0", "important");
      dock.style.setProperty("margin-right", "auto", "important");
      dock.style.setProperty("text-align", "left", "important");
      dock.style.setProperty("float", "none", "important");
    });
    document.querySelectorAll(".js-share-card").forEach(function (link) {
      link.style.setProperty("position", "static", "important");
      link.style.setProperty("left", "auto", "important");
      link.style.setProperty("right", "auto", "important");
      link.style.setProperty("bottom", "auto", "important");
      link.style.setProperty("float", "none", "important");
      link.style.setProperty("margin", "0", "important");
    });
  }

  pinShareButton();
  window.addEventListener("resize", pinShareButton);

  var VCARD_FILE =
    "BEGIN:VCARD\r\n" +
    "VERSION:3.0\r\n" +
    "PRODID:-//PD Psagot//Contact//HE\r\n" +
    "N;CHARSET=UTF-8:פיק;דני;;;\r\n" +
    "FN;CHARSET=UTF-8:דני פיק\r\n" +
    "ORG;CHARSET=UTF-8:פ.ד. נכסים\r\n" +
    "TEL;TYPE=CELL,VOICE:+972523795155\r\n" +
    "EMAIL;TYPE=INTERNET,WORK:danny@pdpsagot.co.il\r\n" +
    "URL;TYPE=WORK:https://www.pdpsagot.co.il\r\n" +
    "END:VCARD\r\n";

  document.querySelectorAll(".js-save-contact").forEach(function (link) {
    link.addEventListener("click", function (event) {
      event.preventDefault();
      var blob = new Blob([VCARD_FILE], { type: "text/vcard;charset=utf-8" });
      var url = URL.createObjectURL(blob);
      var saver = document.createElement("a");
      saver.href = url;
      saver.download = "danny-pik.vcf";
      document.body.appendChild(saver);
      saver.click();
      saver.remove();
      window.setTimeout(function () {
        URL.revokeObjectURL(url);
      }, 2000);
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
      await document.fonts.load("800 112px Heebo");
      await document.fonts.load("800 58px Heebo");
      await document.fonts.load("800 48px Heebo");
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
    ctx.font = "800 112px Heebo, sans-serif";
    ctx.fillText("דני פיק", 1140, 210);
    ctx.fillStyle = "#c4a574";
    ctx.fillRect(1028, 242, 112, 5);
    ctx.fillStyle = "#0f4c81";
    ctx.direction = "ltr";
    ctx.font = "800 58px Heebo, sans-serif";
    ctx.fillText("052-3795155", 1140, 350);
    ctx.font = "800 48px Heebo, sans-serif";
    ctx.fillText("danny@pdpsagot.co.il", 1140, 430);
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
      var text = shareText();
      var android = /Android/i.test(navigator.userAgent || "");
      if (file && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({ files: [file], text: text });
          if (android) {
            await whenBackFromShare();
            openWhatsAppText(text);
          }
          return;
        } catch (err) {
          if (err && err.name === "AbortError") return;
        }
      }
      openWhatsAppText(text);
    });
  });
})();
