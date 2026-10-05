(function () {
  var VCARD =
    "BEGIN:VCARD\r\n" +
    "VERSION:3.0\r\n" +
    "PRODID:-//PD Psagot//Contact//HE\r\n" +
    "N;CHARSET=UTF-8:פיק;דני;;;\r\n" +
    "FN;CHARSET=UTF-8:דני פיק\r\n" +
    "ORG;CHARSET=UTF-8:פ.ד. נכסים\r\n" +
    "TEL;TYPE=CELL,VOICE:+97252375155\r\n" +
    "EMAIL;TYPE=INTERNET,WORK:danny@pdpsagot.co.il\r\n" +
    "URL;TYPE=WORK:https://www.pdpsagot.co.il\r\n" +
    "END:VCARD\r\n";

  function downloadVcard(filename) {
    var blob = new Blob([VCARD], { type: "text/vcard;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var link = document.createElement("a");
    link.href = url;
    link.download = filename || "danny-pik.vcf";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  document.addEventListener("click", function (event) {
    var trigger = event.target.closest("[data-vcard-download]");
    if (!trigger) return;
    event.preventDefault();
    downloadVcard(trigger.getAttribute("data-vcard-download-filename") || "danny-pik.vcf");
  });
})();
