const Discord = require('discord.js');
const client = new Discord.Client();
const fs = require('fs');
const net = require('net');
const reconnect = require('net-socket-reconnect');
const c = require('ansi-colors');

if(!fs.existsSync("config.json")){
    console.log(c.red(`config.json not found please create\nexample: {"Host":"127.0.0.1","Port":50301,"Password":"******","token":"******","ChatChannelID":"123456789123456789"}`));
    process.exit();
}
const config = JSON.parse(fs.readFileSync('config.json'));;
const socket = reconnect({port:config.Port,reconnectInterval:150,reconnectOnError:true,reconnectOnCreate:true,reconnectTimes:Infinity});

client.login(config.token);

client.on("ready",() =>
{   
    console.log(c.green(`Bot is now ready, logged on as ${client.user.tag}`));
    client.user.setStatus("idle")
        .catch(console.error);
});

client.on("message",(msg)=>{
    if(msg.channel.id != config.ChatChannelID || msg.author == client.user) return;
    try{
    let content = msg.content;
    let name = msg.author.tag;
    
    writeToChat(`<${name}> ${content}`);
    }
    catch(e){
        console.error(e);
        msg.channel.send(c.red("There was an error sending the message, not connected?"));
    }
});

function checkConnection(){
    try{
        socket.write("print('testing connecton');");
    }
    catch(e){
        console.log(c.yellow(`Error checking connection: ${e}, attempting to connect`));
        try{
        socket.reconnect();
        }
        catch(e){
            console.log(c.red(`failed to conntect to ${config.Host}:${config.Port}`));
        }
    }
}

socket.connect(config.Port,config.Host);
checkConnection();
setInterval(checkConnection,60000*5);


socket.on("connect",() =>{
    console.log(c.green("Connection success"));
    command(config.Password);
});

socket.on("error", (e)=>{
    console.log(c.red("Socket had an error" + e));
})

socket.on("close",(hadError)=>{
    console.log(c.yellow("Connection closed: error: " + hadError));
});

socket.on("data",(data)=>{
    let content = data.toString().split(/\n/);
    let tokens  = content[0].split(/ /g);
    let time = tokens[0];
    let type = tokens[1];
    if(type == "discordData"){
        let json = content[0].substr(time.length + type.length + 2); //2 being the number of spaces
        let message = JSON.parse(json);
        console.log(message);

        let serverChat = client.channels.get(config.ChatChannelID);

        switch(message.dataType)
        {
            case "chat":
                {
                    let out = `**${message.username}**: \`\`${message.content}\`\``;
            
                    serverChat.send(out);
                }
            break;
            case "playerdie":
                {
                    let out = new Discord.RichEmbed().setThumbnail("https://i.imgur.com/zcNs1yO.png");

                    if(message.attackerNull)
                    {
                        out.setTitle(`**__${message.victim} the ${message.lastVicBlob}__ WAS KILLED!!**`);
                    }else{
                        out.setTitle(`**__${message.victim} the ${message.lastVicBlob} __ WAS KILLED BY __${message.attacker} the ${message.lastAttBlob}__!!**`)
                    }
                    serverChat.send(out);
                }
            break;
            case "playerjoin":
                serverChat.send(new Discord.RichEmbed().setTitle(`**__${message.username}__ HAS JOINED!**`).setDescription("Say hello!"));
            break;
            case "playerleave":
            serverChat.send(new Discord.RichEmbed().setTitle(`**__${message.username}__ has left.**`)).then((x)=> x.react('😢'));
            break;
        }
    }
});

function command(cmd){
    try{
    socket.write(cmd + "\n");
    }
    catch(e){
        console.log(c.yellow("failed to send command, testing connection"));
        checkConnection();
    }
}

function writeToChat(message){
    message = message.replace(/\\/g,"\\\\")
    .replace(/"/g,'\\"')
    .replace(/'/g,"\\'")
    .replace(/\*/g,"\\*")
    .replace(/_/g,"\_")
    .replace(/~/g,"\~");//sanitise content to prevent code injection
    
    command(`CRules@ r = getRules();CBitStream p; p.write_string("${message}"); r.SendCommand(r.getCommandID("addToChat"),p,true);`);
}