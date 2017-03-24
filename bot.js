const tbot = require("telebot");
const config = require("./private.js");
const low = require("lowdb");
const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const aziende = low("aziende.json");

const conversazioni = low("conversazioni.json");

aziende.defaults(
    [
        {
            name: "MultiHub Development"
        }
    ]
).write();

const bot = new tbot(config.bot_token);
bot.flags.poll = true;
bot.flags.looping = true;

bot.on("text", function (event) {
    var data = new Date(event.date * 1000);
    console.log("[" + formattedDate(data) + "] Text from " + event.from.username + " (" + event.from.id + "): " + event.text);

    if (conversazioni.get(event.from.id + ".waitingForAgentCode").value()) {
        parseAgentCode(event);
    }

});

bot.on("/cliente", function (event) {
    console.log("Sub request received");
    bot.sendMessage(event.from.id, "Inserisci il codice che ti è stato dato dall'ente da cui vuoi le notifiche");
    conversazioni.set(event.from.id + ".waitingForAgentCode", true).write();
    /*
    if (!dati[event.from.id + ""]) dati[event.from.id + ""] = {};
    dati[event.from.id + ""].waitingForAgentCode = true;
    */
});

bot.on("/azienda", function (event) {

});

bot.connect();

function parseAgentCode(event) {

    var aname = aziende.get(event.text + ".name").value();

    if (aname) {
        subscribeToAgent(event.text, event.from.id);
        bot.sendMessage(event.from.id, "Ti sei iscritto correttamente alle notifiche di " + aname);
    } else {
        bot.sendMessage(event.from.id, "Il codice inserito non è valido");
    }
    conversazioni.set(event.from.id + ".waitingForAgentCode", false).write();
}


function formattedDate(data) {
    var st = "";
    st += data.getDate() + "/";
    st += monthName[data.getMonth()] + "/";
    st += (1900 + data.getYear()) + " - ";
    st += data.getHours() + ":";
    var min = data.getMinutes();
    st += (min < 10 ? '0' + min : min) + ":";
    st += data.getSeconds();
    return st;
}

function subscribeToAgent(agent, client) {
    console.log("Subscribed " + client + " to " + agent);
}