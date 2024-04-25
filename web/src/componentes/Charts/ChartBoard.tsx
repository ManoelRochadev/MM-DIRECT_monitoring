import { useEffect, useMemo, useState } from "react";
//import { sharedData } from "./ChartContext";
import CpuChart from "./CpuChart";
import TransactionChart from "./TransferChart";
import MemoryChart from "./MemoryChart";
//import FocusChart from "./FocusChart";
import TerminalController from "../TerminalController";
import ToggleSwitch from "./ToggleSwitch";
import ReloadButton from "../ReloadButton";
import { ScatterChart } from "./ScatterChart";

interface ChartBoardProps {
    cpuChart: boolean;
    transferChart: boolean;
    terminalLog: string[];
    onReloadButtonClick: (e: Event, chartConnections: WebSocket[]) => void;
}

const ChartBoard = ({
    cpuChart,
    transferChart,
    terminalLog,
    onReloadButtonClick,
}: ChartBoardProps) => {
    const [showInsights, setShowInsights] = useState<boolean>(true);
    const [showTerminal, setShowTerminal] = useState<boolean>(true);
   
    const [selectedChart, setSelectedChart] = useState<"CpuChart" | "TransactionChart" | "MemoryChart" | "ScatterChart">("CpuChart");
   // const [focusChartData, setFocusChartData] = useState<[[string, string][], [number, number][]][]>([]);
   // const [focusChartConfig, setFocusChartConfig] = useState<any>(null);
    const [chartConnections, setChartConnections] = useState<WebSocket[]>([]);
    const [dataCPU, setDataCPU] = useState<[number, number][]>([]);
    const [dataTransfer, setDataTransfer] = useState<[number, number][]>([]);
    const [dataMemory, setDataMemory] = useState<[number, number][]>([]);

    // variável para armazenar o timestamp da última atualização
    const timestampsCpu: number[] = [];
    const timestampsMemory: number[] = [];

    // estado para armazenar o maior valor de memória usado
    const [maxMemoryUsage, setMaxMemoryUsage] = useState(0);

    // variável para armazenar a porcentagem de uso da CPU
    const cpuUsage: number[] = [];
    const memoryUsage: number[] = [];

    const focusChartComponents = useMemo(() => ({
        "CpuChart": <CpuChart  data={dataCPU} chartMode="default" />,
        "TransactionChart": <TransactionChart data={dataTransfer} chartMode="default" />,
        "MemoryChart": <MemoryChart data={dataMemory} chartMode="default" />,
        "ScatterChart": <ScatterChart chartMode="default" />,
    }), [dataCPU, dataTransfer, dataMemory]);

    useEffect(() => {
        const ws = new WebSocket("ws://localhost:8081/cpu");
        ws.onopen = () => {
            console.log(`conexão aberta em ${CpuChart.name}`);
            setChartConnections((prevInfo: WebSocket[]) => [...prevInfo, ws]);
        }
        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                timestampsCpu.push(message[0]);
                cpuUsage.push(message[1]);

                if (timestampsCpu.length > 1 && timestampsCpu[timestampsCpu.length - 1] === timestampsCpu[timestampsCpu.length - 2]) {

                    const media = (cpuUsage[cpuUsage.length - 1] + cpuUsage[cpuUsage.length - 2]) / 2;

                    setDataCPU((dadosAnteriores) => {
                        const novosDados = [...dadosAnteriores];
                        novosDados[novosDados.length - 1] = [message[0], media];
                        return novosDados;
                    });

                } else {

                    // Se os timestamps forem diferentes, adiciona simplesmente o novo ponto de dados
                    setDataCPU((dadosAnteriores) => [...dadosAnteriores, message]);

                }
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };

      return  ws.onclose = () => {
            console.log("CPU Connection closed");
        };


    }, []);

    useEffect(() => {
        const ws = new WebSocket("ws://localhost:8081/data");

        ws.onopen = () => {
            console.log(`conexão aberta em ${TransactionChart.name}`);
            setChartConnections((prevInfo: WebSocket[]) => [...prevInfo, ws]);
        }

        ws.onmessage = (event) => {
            try {
                const endMessage = "CSV file successfully processed";
                if (event.data !== endMessage) {


                    const message = JSON.parse(event.data);
                    setDataTransfer((prevInfo) => [...prevInfo, message]);

                }
                if (event.data === endMessage) {
                    ws.close();
                }
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };

      return  ws.onclose = () => {
            console.log("Transfer Connection closed");
        };
    }, [])

    useEffect(() => {
        const ws = new WebSocket("ws://localhost:8081/memory");

        ws.onopen = () => {
            console.log(`conexão aberta em ${MemoryChart.name}`);
            setChartConnections((prevInfo: WebSocket[]) => [...prevInfo, ws]);
        }

        ws.onmessage = (event) => {
            try {
                const message = JSON.parse(event.data);

                timestampsMemory.push(message[0]);
                // transforma o valor de bytes para megabytes
                memoryUsage.push(message[1] / 1024);
                if (
                    timestampsMemory.length > 1 &&
                    timestampsMemory[timestampsMemory.length - 1] ===
                    timestampsMemory[timestampsMemory.length - 2]
                ) {
                    const media =
                        (memoryUsage[memoryUsage.length - 1] +
                            memoryUsage[memoryUsage.length - 2]) /
                        2;

                    setDataMemory((dadosAnteriores) => {
                        const novosDados = [...dadosAnteriores];
                        novosDados[novosDados.length - 1] = [message[0], media];

                        // verifica se o novo valor é maior que o maior valor de memória usado
                        if (media > maxMemoryUsage) {
                            setMaxMemoryUsage(media);
                        }
                        return novosDados;
                    });
                } else {
                    // Se os timestamps forem diferentes, adiciona simplesmente o novo ponto de dados

                    setDataMemory((dadosAnteriores) => {
                        // verifica se o novo valor é maior que o maior valor de memória usado
                        if (message[1] > maxMemoryUsage) {
                            setMaxMemoryUsage(message[1]);
                        }
                        return [
                            ...dadosAnteriores,
                            [message[0], message[1] / 1024],
                        ];
                    });
                }


            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };

       return ws.onclose = () => {
            console.log("Memory Connection closed");
        };
    }, [])

    useEffect(() => {
        const ws = new WebSocket("ws://localhost:8081/latencia");

        ws.onopen = () => {
            console.log(`conexão aberta em ${ScatterChart.name}`);
            setChartConnections((prevInfo: WebSocket[]) => [...prevInfo, ws]);
        }

        ws.onmessage = (event) => {
            try {
                console.log(event.data);
            } catch (error) {
                console.error("Error parsing WebSocket message:", error);
            }
        };
    }, [])



    const ToggleTargetComponent = (targetValue: any, setTargetValue: any) => {
        setTargetValue(!targetValue)
    };

    const handleChartClick = (chartName: "CpuChart" | "TransactionChart" | "MemoryChart" | "ScatterChart") => {
        setSelectedChart(chartName);
        console.log(chartName)
    }

    return (
        <div className="grid grid-cols-2 gap-y-5 w-[95%] mx-auto my-8 p-4 bg-slate-200 rounded">

            <ToggleSwitch SwitchLabel="Charts" SwitchName="toggle-scharts" ToggleFunction={() => { ToggleTargetComponent(showInsights, setShowInsights) }} />
            <ToggleSwitch SwitchLabel="Terminal" SwitchName="toggle-terminal" ToggleFunction={() => { ToggleTargetComponent(showTerminal, setShowTerminal) }} />


            <div className={`grid grid-cols-4 col-span-2 gap-2`}>

                <>
                    <div className="space-y-3">
                        <button id="chart_1" className={`${showInsights ? "" : 'hidden'} w-full`} onClick={() => handleChartClick("CpuChart")}>
                            {cpuChart && <CpuChart chartMode="minimalist" data={dataCPU} />}
                        </button>
                        <button id="chart_2" className={`${showInsights ? "" : 'hidden'} w-full`} onClick={() => handleChartClick("TransactionChart")}>
                            {transferChart && <TransactionChart data={dataTransfer} chartMode="minimalist"/>}
                        </button>
                        <button id="chart_3" className={`${showInsights ? "" : 'hidden'} w-full`} onClick={() => handleChartClick("MemoryChart")}>
                            {transferChart && <MemoryChart chartMode="minimalist" data={dataMemory} />}
                        </button>
                        <button
                        id="chart_4"
                        className={`${showInsights ? "" : 'hidden'} w-full`}
                        onClick={() => handleChartClick("ScatterChart")}
                        >
                            {transferChart && <ScatterChart />}
                        </button>
                    </div>

                    <div className={` bg-slate-500 col-span-3 ${showInsights || 'hidden'}`}>
                        {focusChartComponents[selectedChart]}
                    </div>
                </>

                {!showInsights &&
                    (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className=" col-span-full justify-self-center w-32 h-32 stroke-slate-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 0 0 6 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0 1 18 16.5h-2.25m-7.5 0h7.5m-7.5 0-1 3m8.5-3 1 3m0 0 .5 1.5m-.5-1.5h-9.5m0 0-.5 1.5m.75-9 3-3 2.148 2.148A12.061 12.061 0 0 1 16.5 7.605" />
                    </svg>)
                }

            </div>



            <div className="grid grid-cols-subgrid  col-span-2 w-4/5">
                <div className={` justify-self-center col-span-2 w-4/5 ${showTerminal || 'hidden'}`}>
                    <TerminalController value={terminalLog} />
                </div>
                {!showTerminal &&
                    (<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className=" col-span-2 justify-self-center w-32 h-32 stroke-slate-500">
                        <path strokeLinecap="round" strokeLinejoin="round" d="m6.75 7.5 3 2.25-3 2.25m4.5 0h3m-9 8.25h13.5A2.25 2.25 0 0 0 21 18V6a2.25 2.25 0 0 0-2.25-2.25H5.25A2.25 2.25 0 0 0 3 6v12a2.25 2.25 0 0 0 2.25 2.25Z" />
                    </svg>)
                }
            </div>

            <ReloadButton onButtonClick={(e: Event) => { onReloadButtonClick(e, chartConnections) }} />
        </div>
    );
};

export default ChartBoard;
