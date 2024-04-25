import express from "express";
import fs from 'fs';
import csv from 'csv-parser';
import { WebSocketServer } from 'ws';
import cors from 'cors';
import path from "path";
import { Tail } from "tail";
import child_process from 'child_process';
import { fileURLToPath } from 'url';
import os from 'os';
import { modifyConfigFile } from "./config-mm-direct.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
app.use(cors({
  origin: '*'
}));

const port = 8081;

// start react app
const reactApp = path.join(__dirname, './web');

// listar diretórios do react app
const directories = fs.readdirSync(reactApp)
// se existir não existir node_modules, instalar as dependências
if (!directories.includes('node_modules')) {
  child_process.execSync('npm install', {
    cwd: reactApp
  })
  child_process.execSync('npm install', {
    cwd: reactApp
  })
}

const reactProcess = child_process.spawn('npm', ['run', 'dev'], {
  cwd: reactApp,
})

reactProcess.stdout.on('data', (data) => {
  const output = data.toString();
  console.log(output);
});


let rootPath = null; // Caminho do arquivo CSV a ser processado
// ler arquivo json config.json
const config = await JSON.parse(fs.readFileSync(path.join(__dirname, 'config.json'), 'utf-8'));

rootPath = os.homedir() + config.path;

// Caminho do arquivo CSV a ser processado
//path.join(__dirname, '../../MM-DIRECT/src/datasets/datasets.csv');
const inputPath = rootPath + "/src/datasets/datasets.csv"
// '../../MM-DIRECT/src/system_monitoring/system_monitoring.csv'
const pathCpu = rootPath + "/src/system_monitoring/system_monitoring.csv"

// Variáveis de controle
let total = 0; // Contador de linhas no CSV
let totalLatencia = 0; // Contador de linhas no CSV
let database_startup_time = 0; // Armazena o tempo de inicialização do banco de dados
let database_startup_time_latencia = 0; // Armazena o tempo de inicialização do banco de dados
const contagemComandos = []; // Armazena os arrays de contagem de comandos por segundo
let arrayParaVerificarSeJaFoiEnviado = []; // Armazena os arrays para verificação de envio
let lendoArquivo = false; // Variável de controle para verificar se o arquivo está sendo lido
const x = [];
const y = [];
const x1 = [];
const x2 = [];
const y1 = [];
const y2 = [];
let databaseStartupCpu = 0;
let databaseStartupMemoria = 0;

const server = app.listen(port, () => {
  console.log(`rota para configuração do arquivo redis_ir.conf: http://localhost:${port}/config`);
});

// Criar um servidor WebSocket
const wss = new WebSocketServer({ server }, () => {
  console.log(`
  rota para o dataset de comandos por segundo: ws://localhost:8080/data
  rota para o dataset de uso de cpu: ws://localhost:8080/cpu
  `);
});
// rota para configurar o arquivo de configuração do MM-DIRECT
app.post('/config', express.json(), (req, res) => {
  const config = req.body;

  modifyConfigFile(config, rootPath);

  res.json(config);
});

// função para contagem de comandos por segundo
const processaCSV = async (ws, inputPath) => {
  fs.createReadStream(inputPath, {
    start: total,
  })
    .pipe(csv())
    .on('data', (row) => {
      total++;
      lendoArquivo = true;

      // Processar cada linha do CSV
      if (total === 1) {
        // Obter o tempo de inicialização do banco de dados a partir da segunda linha
        database_startup_time = parseInt(row.startTime);
      } else if (total >= 3) {
        if (row.type !== '0' && !isNaN(row.finishTime)) {
          // Calcular o tempo em segundos a partir do tempo de término e do tempo de inicialização
          const tempoTermino = parseInt(row.finishTime);
          const tempoEmSegundos = Math.floor((tempoTermino - database_startup_time) / 1000000);

          if (tempoEmSegundos >= 0) {
            // Verificar se o array para esse segundo já existe
            const entryIndex = contagemComandos.findIndex(entry => entry[0] === tempoEmSegundos);

            if (entryIndex === -1) {
              // Se não existe, adicionar um novo array de contagem
              contagemComandos.push([tempoEmSegundos, 1]);
            } else {
              // Se existe, incrementar a contagem de comandos
              contagemComandos[entryIndex][1]++;
            }
          }
        }
      }

      // Verificar se o tamanho do array aumentou e enviar o penúltimo elemento apenas uma vez
      for (let i = 0; i < contagemComandos.length; i++) {
        if (contagemComandos.length > arrayParaVerificarSeJaFoiEnviado.length) {
          if (i === contagemComandos.length - 2) {
            arrayParaVerificarSeJaFoiEnviado.push(contagemComandos[i]);
            ws.send(JSON.stringify(contagemComandos[i]));
          }
        }
      }
    })
    .on('end', () => {
      console.log('CSV file successfully processed');
      // Enviar o último elemento do array para a conexão WebSocket
      // ws.send(JSON.stringify(contagemComandos[contagemComandos.length - 1]));
      lendoArquivo = false;
    });
}

// função para calcular latência
const processaLatencia = async (ws, inputPath) => {
  fs.createReadStream(inputPath, {
    start: totalLatencia,
  })
    .pipe(csv())
    .on('data', (row) => {
      totalLatencia++;
      lendoArquivo = true;

      // Processar cada linha do CSV
      if (totalLatencia === 1) {
        database_startup_time_latencia = parseInt(row.startTime);
      } else if (totalLatencia >= 3) {
        // vericar se a latência é maior que 0
        if (parseInt(row.type) != '0') {
          const num = parseInt((parseInt(row.startTime) - database_startup_time_latencia) / 1000000);
          if (row.type === 'N') {
            x1.push(num);
            y1.push(parseInt(row.latency));
            ws.send(JSON.stringify({ 1: [num, parseInt(row.latency)] }));
          }
          if (row.type === 'A') {
            x2.push(num);
            y2.push(parseInt(row.latency));
            ws.send(JSON.stringify({ 2: [num, parseInt(row.latency)] }));

          }
        }
      }
    })
}

// função para processar o dataset de uso de cpu
const processaCpu = async (ws, pathCpu) => {
  const data = await fs.promises.readFile(pathCpu, 'utf-8');
  const lines = data.trim().split('\n');

  if (lines.length > 2) {
    const databaseStartupLine = lines[1].split(';');
    const databaseStartupTime = parseInt(databaseStartupLine[2]);

    databaseStartupCpu = databaseStartupTime;

    console.log(databaseStartupCpu)
    console.log(lines)

    lines.splice(0, 2); // Remove header and database startup information

    for (let i = 0; i < lines.length; i++) {
      const linha = lines[i].split(';');
      if (linha[0].match(/^\d+$/)) {
        const num = Math.floor((parseInt(linha[0]) - databaseStartupTime) / 1000000);
        x.push(num);
        y.push(parseFloat(linha[1]));

        ws.send(JSON.stringify([num, parseFloat(linha[1])]));
      }
    }
  }
}

// função para processar o dataset de uso de memória
const processaMemoria = async (ws, pathMemoria) => {
  const data = await fs.promises.readFile(pathCpu, 'utf-8');
  const lines = data.trim().split('\n');

  if (lines.length > 2) {
    const databaseStartupLine = lines[1].split(';');
    const databaseStartupTime = parseInt(databaseStartupLine[2]);

    databaseStartupMemoria = databaseStartupTime;

    lines.splice(0, 2); // Remove header and database startup information

    for (let i = 0; i < lines.length; i++) {
      const linha = lines[i].split(';');
      if (linha[0].match(/^\d+$/)) {
        const num = Math.floor((parseInt(linha[0]) - databaseStartupTime) / 1000000);
        x.push(num);
        y.push(parseFloat(linha[2]));

        ws.send(JSON.stringify([num, parseInt(lines[2])]));
      }
    }
  }

}

// conexão websocket
wss.on('connection', async (ws, req) => {
  console.log('Client connected');

  // rota websocket para o dataset de comandos por segundo
  if (req.url === '/data') {
    const tail = new Tail(inputPath);

    await processaCSV(ws, inputPath);

    tail.on("line", function (data) {
      const line = data.split(',');

      const endTime = parseInt(line[2]);
      const startTime = parseInt(line[1]);

      if (line[0] !== '0' && !isNaN(endTime)) {
        // Calcular o tempo em segundos a partir do tempo de término e do tempo de inicialização
        const tempoEmSegundos = Math.floor((endTime - database_startup_time) / 1000000);

        if (tempoEmSegundos >= 0) {
          // Verificar se o array para esse segundo já existe
          const entryIndex = contagemComandos.findIndex(entry => entry[0] === tempoEmSegundos);

          if (entryIndex === -1) {
            // Se não existe, adicionar um novo array de contagem
            contagemComandos.push([tempoEmSegundos, 1]);
          } else {
            // Se existe, incrementar a contagem de comandos
            contagemComandos[entryIndex][1]++;
          }
        }
      }

      // Verificar se o tamanho do array aumentou e enviar o penúltimo elemento apenas uma vez
      for (let i = 0; i < contagemComandos.length; i++) {
        if (contagemComandos.length > arrayParaVerificarSeJaFoiEnviado.length) {
          if (i === contagemComandos.length - 2) {
            arrayParaVerificarSeJaFoiEnviado.push(contagemComandos[i]);
            ws.send(JSON.stringify(contagemComandos[i]));
          }
        }
      }
    });

    // se o usuário fechar a conexão, encerre o processo do servidor Redis e pare de ler o arquivo CSV
    ws.on('close', () => {
      tail.unwatch();
      // limpar os arrays
      contagemComandos.length = 0;
      arrayParaVerificarSeJaFoiEnviado.length = 0;
      total = 0;
      database_startup_time = 0;
    });
  }
  // rota websocket para o dataset de uso de cpu
  else if (req.url === '/cpu') {

    await processaCpu(ws, pathCpu);

    const tail = new Tail(pathCpu);

    tail.on("line", function (data) {
      const lines = data.split(';')

      const endTime = parseInt(lines[0]);

      if (lines[0] === "Database startup") {
        databaseStartupCpu = parseInt(lines[2]);
      }

      if (lines[0].match(/^\d+$/)) {
        const num = Math.floor((endTime - databaseStartupCpu) / 1000000);
        x.push(num);
        y.push(parseFloat(lines[1]));

        ws.send(JSON.stringify([num, parseFloat(lines[1])]));
      }
    });


    // se o usuário fechar a conexão, encerre o processo do servidor Redis e pare de ler o arquivo CSV
    ws.on('close', () => {
      tail.unwatch();
      // limpar os arrays
      x.length = 0;
      y.length = 0;
    });

  }
  // rotar para iniciar o servidor MM-DIRECT
  else if (req.url === '/start') {
    const redisServerPath = path.join(rootPath, '/src');

    // Navegue até a pasta onde o redis-server está localizado
    process.chdir(redisServerPath);

    // apagar o arquivo de log datasets.csv verificando se ele existe
    const logFile = path.join(redisServerPath, 'datasets/datasets.csv');

    if (fs.existsSync(logFile)) {
      fs.unlinkSync(logFile);
    }

    // iniciar o servidor MM-DIRECT
    const child = child_process.spawn('./redis-server');

    child.on('error', (err) => {
      console.error(`Erro ao iniciar o servidor Redis: ${err}`);
    });

    /*
        child.on('exit', (code, signal) => {
          console.log(`Servidor Redis encerrado com código ${code} e sinal ${signal}`);
          ws.send('Redis server stopped');
          ws.close();
        });
    */
    // ouvir o evento de saída do processo
    child.stdout.on('data', (data) => {
      ws.send('Redis server started');
      const output = data.toString();
      console.log(output);
      ws.send(output);

      // Use uma expressão regular para verificar a mensagem
      const regex = /Memtier benchmark execution finished: \d+\.\d+ seconds\./;
      // verificar se está gerando "Generating information about executed database commands ..."
      const regex2 = /Generating information about executed database commands .../;
      const regex3 = /Generating system monitoring .../;

      if (regex2.test(output)) {
        console.log('Gerando informações sobre os comandos do banco de dados executados ...');
        ws.send('Generating information database commands');
      }

      if (regex3.test(output)) {
        console.log('Gerando monitoramento do sistema ...');
        ws.send('Generating system monitoring');
      }

      /*
      if (regex.test(output)) {
        console.log('Encerrando o servidor Redis...');
        child.kill(); // Encerre o processo do servidor Redis
      }
      */
    });

    // se o usuário fechar a conexão, encerre o processo do servidor Redis
    ws.on('close', () => {
      child.kill();
    });
  }
  // rota para parar o servidor MM-DIRECT
  else if (req.url === '/stop') {
    const redisServerPath = path.join(__dirname, '../../MM-DIRECT/src');

    // Navegue até a pasta onde o redis-server está localizado
    process.chdir(redisServerPath);

    const child = child_process.spawn('./redis-cli', ['shutdown']);

    child.on('error', (err) => {
      console.error(`Erro ao iniciar o servidor Redis: ${err}`);
    });

    child.on('exit', (code, signal) => {
      console.log(`Servidor Redis encerrado com código ${code} e sinal ${signal}`);
      ws.send('Redis server stopped');
      ws.close();
    });

    child.stdout.on('data', (data) => {
      ws.send('Redis server stopped');
      const output = data.toString();
      console.log(output);
    });

    // se o usuário fechar a conexão, encerre o processo do servidor Redis
    ws.on('close', () => {
      child.kill();
    });
  }

  else if (req.url === '/memory') {
    const tail = new Tail(pathCpu);

    await processaMemoria(ws, pathCpu);

    tail.on("line", function (data) {
      const lines = data.split(';')

      const endTime = parseInt(lines[0]);

      if (lines[0] === "Database startup") {
        databaseStartupMemoria = parseInt(lines[2]);
      }

      if (lines[0].match(/^\d+$/)) {
        const num = Math.floor((endTime - databaseStartupMemoria) / 1000000);
        x.push(num);
        y.push(parseFloat(lines[2]));

        ws.send(JSON.stringify([num, parseInt(lines[2])]));
      }
    });
  }

  else if (req.url === '/latencia') {
    await processaLatencia(ws, inputPath);

    console.log('latencia')
    const tail = new Tail(inputPath);

    tail.on("line", function (data) {
      const lines = data.split(';')
      console.log(lines)

      const endTime = parseInt(lines[0]);


      if (lines[0].match(/^\d+$/)) {
        const num = Math.floor((endTime - database_startup_time) / 1000000);

        if (lines[5] === 'N') {
          x1.push(num);
          y1.push(parseInt(lines[4]));
          ws.send(JSON.stringify({ 1: [num, parseInt(lines[4])] }));
        }
        if (lines[5] === 'A') {
          x2.push(num);
          y2.push(parseInt(lines[4]));
          ws.send(JSON.stringify({ 2: [num, parseInt(lines[4])] }));
        }
      }
    
    });

  }
  else {
    ws.send('Invalid URL');
  }
});
