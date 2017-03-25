const tbot = require("telebot");
const config = require("./private.js");
const low = require("lowdb");
const monthName = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

const aziende = low("aziende.json");

const conversazioni = low("conversazioni.json");

console.log("Avvio server MultiHub");

aziende.defaults(
    [
        {
            name: "MultiHub Development",
            conv: 54794270,
            subs: []
        }
    ]
).write();

const bot = new tbot({
    token: config.bot_token,
    polling: {
        interval: 1000,
        timeout: 1000,
        limit: 100
    }
});

bot.on("text", function (event) {
    var data = new Date(event.date * 1000);
    console.log("[" + formattedDate(data) + "] Text from " + event.from.username + " (" + event.from.id + "): " + event.text);
    if (event.text.charAt(0) != "/") {
        var wfac = conversazioni.get(event.from.id + ".waitingForAgentCode").value();
        console.log(wfac);
        if (wfac == 1) {
            parseAgentCode(event);
        } else if (wfac == 2) {
            rimuoviAgentCode(event);
        }
    }
});

bot.on("/registra", function (event) {
    console.log("Sub request received");
    bot.sendMessage(event.from.id, "Inserisci il codice che ti è stato dato dall'ente da cui vuoi le notifiche.\nRispetta gli spazi");
    conversazioni.set(event.from.id + ".waitingForAgentCode", 1).write();
});

bot.on("/nuovoAgente", function (event) {

    var text = event.text.split(" ").splice(0, 1).join(" ");
    if (aziende.find({ name: text }).value()) {
        bot.sendMessage("Esiste già un agente chiamato " + text);
        return;
    }

    if (aziende.find({ conv: event.from.id }).value()) {
        bot.sendMessage("Sei già registrato come " + aziende.find({ conv: event.from.id }).get("name").value());
        return;
    }

    aziende.push({
        name: text,
        conv: event.from.id,
        subs: []
    })

    bot.sendMessage("Sei ora registrato come " + text);
});

bot.on("/notifica", function (event) {

    var agt = aziende.find({ conv: event.from.id }).value();

    if (!agt) {
        bot.sendMessage(event.from.id, "Non sei un fornitore registrato! Per favore registrati con /nuovoAgente [nomeUnico]");
        return;
    }

    var tsp = event.text.split(" ");

    if (tsp.length < 3) {
        bot.sendMessage(event.from.id, "Notifica non valida, usa /notifica [CID] [Messaggio]");
        return;
    }

    var uid = tsp[1];
    tsp.splice(0, 2);
    var testo = tsp.join(" ");

    var tca = aziende.find({ conv: event.from.id }).get("subs").value();

    var tc = tca.find(sub => {
        return sub.cid == uid;
    });

    if (tc) {
        bot.sendMessage(uid, "Hai una nuova notifica da " + agt.name + "\n\n" + testo);
    } else {
        bot.sendMessage(event.from.id, "Non puoi inviare notifiche a chi non è iscritto");
    }
});

bot.on("/rimuovi", function (event) {
    console.log("Unsub request received");
    bot.sendMessage(event.from.id, "Inserisci il codice del fornitore di notifiche da cui ti vuoi rimuovere.\nPuoi trovare i codici con /iscrizioni");
    conversazioni.set(event.from.id + ".waitingForAgentCode", 2).write();
});

bot.on("/start", function(event) {
    initSubscriber(event);
    bot.sendMessage(event.from.id, "Benvenuto su MultiHub!\nSe sei un'azienda che vuole utilizzare il servizio contatta zabi94@gmail.com");
    bot.sendMessage(event.from.id, "Questi sono i comandi disponibili agli utenti:\n/registra per iscriversi ad un fornitore\n/iscrizioni per elencare tutti i servizi attivi\n/rimuovi per disattivare un servizio");
});

bot.on("connect", function () {
    console.log("Avvio completato, il server è in ascolto per nuovi messaggi");
});

bot.on("disconnect", function () {
    console.log("Il programma è stato terminato. Se non hai intrapreso tu lo spegnimento controlla il log degli errori");
});

bot.on("/iscrizioni", function (event) {
    var str = "";
    var azs = conversazioni.get(event.from.id + ".subs").value();
    for (var i = 0; i < azs.length; i++) {
        str += aziende.get(azs[i] + ".name") + "\t[" + azs[i] + "]\n";
    }

    bot.sendMessage(event.from.id, "Iscrizioni:\n\n" + str + "\nIl numero tra parentesi è il codice per disiscriversi");

});

bot.connect();

function parseAgentCode(event) {
    var codes = event.text.split(" ");
    var aname;
    if (codes.length > 1) {
        aname = aziende.get(codes[0] + ".name").value();
    }
    if (aname) {
        subscribeToAgent(codes, event.from.id);
    } else {
        bot.sendMessage(event.from.id, "Il codice inserito non è valido");
    }
    conversazioni.set(event.from.id + ".waitingForAgentCode", 0).write();
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

function subscribeToAgent(agentCodes, client) {

    var agentCode = agentCodes[0];
    agentCodes.splice(0, 1);
    var agentConv = aziende.get(agentCode + ".conv").value();
    var aname = aziende.get(agentCode + ".name").value();

    if (aziende.get(agentCode + ".subs").find({ cid: client }).value()) {
        bot.sendMessage(client, "Sei già iscritto a " + aziende.get(agentCode + ".name").value());
        return;
    }

    bot.sendMessage(agentConv, "NC:" + agentCodes.join("#") + "#CID:" + client);
    aziende.get(agentCode + ".subs").push(
        {
            cid: client,
            aid: agentCodes.join("#")
        }
    ).write();
    conversazioni.get(client+".subs").push(agentCode).write();
    bot.sendMessage(client, "Ti sei iscritto correttamente alle notifiche di " + aname);
    console.log("Subscribed " + client + " to " + agentCode + " with clientCode " + agentCodes);
}

function rimuoviAgentCode(event) {
    conversazioni.set(event.from.id + ".waitingForAgentCode", 0).write();
    if (event.text.split(" ").length != 1 || !aziende.get(event.text + ".name").value()) {
        bot.sendMessage(event.from.id, "Codice non valido");
        return;
    }
    if (!aziende.get(event.text + ".subs").find({ cid: event.from.id }).value()) {
        bot.sendMessage(event.from.id, "Non eri iscritto a " + aziende.get(event.text + ".name").value());
        return;
    }

    aziende.get(event.text + ".subs").remove({ cid: event.from.id }).write();
    conversazioni.get(event.from.id + ".subs").remove(event.text).write();
    bot.sendMessage(event.from.id, "Non sei più iscritto a " + aziende.get(event.text + ".name").value());
    bot.sendMessage(aziende.get(event.text + ".conv").value(), "UNSUB:" + event.from.id);
}

function initSubscriber(event) {
    if (conversazioni.get(event.from.id).value() === undefined) {
        conversazioni.set(event.from.id + ".waitingForAgentCode", 0).write();
        conversazioni.set(event.from.id + ".subs", []).write();
    }
}