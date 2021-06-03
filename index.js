process.env.DEBUG = "IRobotHost,IRobot";
process.title = process.env.title || "irobot-microservice";

const HostBase = require("microservice-core/HostBase"),
  debug = require("debug")("iRobot"),
  console = require("console"),
  dorita980 = require("dorita980");

const MQTT_HOST = process.env.MQTT_HOST || "mqtt://nuc1",
  topicRoot = process.env.TOPIC_ROOT || "irobot";

const POLL_TIME = 10;

class IRobot extends HostBase {
  // constructor(host, type, blid, passwd) {
  constructor(robot) {
    const host = robot.device;
    super(MQTT_HOST, `${topicRoot}/${host}`);

    const ENV = robot.env,
      BLID = process.env[ENV + "BLID"],
      PASSWD = process.env[ENV + "PASSWD"];

    this.host = host;
    this.type = robot.type;
    this.blid = BLID;
    this.passwd = PASSWD;
    this.connected = false;
    this.favorites = robot.favorites;
    this.state = { favorites: this.favorites };

    //
    this.handleConnect = this.handleConnect.bind(this);
    this.handleState = this.handleState.bind(this);
  }

  handleConnect() {
    this.connected = true;
  }

  handleState(data) {
    // console.log("handleState", data);
  }

  async connect() {
    this.robot = new dorita980.Local(this.blid, this.passwd, this.host);
    this.robot.on("connect", this.handleConnect);
    this.robot.on("state", this.handleState);

    for (;;) {
      if (this.connected) {
        return;
      }
      await this.wait(100);
    }
  }

  async disconnect() {
    try {
      this.robot.end();
    } catch (e) {
      console.error("disconnect exception", e);
    }
  }

  async run() {
    const waitForFields = ["batPct", "bbchg3"];
    console.log(`${this.host} run waiting for connection`);
    await this.connect();

    // if (this.favorites) {
    //   await this.robot.cleanRoom({ favorite_id: this.favorites[0].id });
    // }
    const lastCommand = { command: "", time: 0 };

    for (;;) {
      const robotState = await this.robot.getRobotState(waitForFields);
      if (
        robotState.lastCommand.command !== lastCommand.command ||
        robotState.lastCommand.time != lastCommand.time
      ) {
        console.log(this.host, "lastCommand", robotState.lastCommand);
        lastCommand.command = robotState.lastCommand.command;
        lastCommand.time = robotState.lastCommand.time;
      }
      // console.log(robotState);
      this.state = { fullState: robotState };
      this.state = {
        type: this.type,
        name: robotState.name,
        battery: robotState.batPct,
        connected: robotState.connected,
        detectedPad: robotState.detectedPad,
        dockKnown: robotState.dock.known,
        tankLevel: robotState.tankLvl,
        bbchg3: robotState.bbchg3,
        bbrun: robotState.bbrun,
        bin: robotState.bin,
        lastCommand: robotState.lastCommand,
        cleanMissionStatus: robotState.cleanMissionStatus,
        mopReady: robotState.mopReady,
        padWetness: robotState.padWetness
      };
      const missionState = await this.robot.getBasicMission();
      this.state = { phase: missionState.phase };
      this.state = missionState;
      await this.wait(POLL_TIME * 1000);
    }
  }

  // commands
  async start() {
    try {
      return await this.robot.start();
    } catch (e) {
      console.error("start exception", e);
    }
    return { error: null };
  }

  async train() {
    try {
      return await this.robot.train();
    } catch (e) {
      console.error("train exception", e);
    }
    return { error: null };
  }

  async clean() {
    try {
      return await this.robot.clean();
    } catch (e) {
      console.error("clean exception", e);
    }
    return { error: null };
  }

  async cleanRoom(args) {
    try {
      return await this.robot.cleanRoom(args);
    } catch (e) {
      console.error("cleanRoom exception", e);
    }
    return { error: null };
  }

  async pause() {
    try {
      return await this.robot.pause();
    } catch (e) {
      console.error("pause exception", e);
    }
    return { error: null };
  }

  async stop() {
    try {
      return await this.robot.stop();
    } catch (e) {
      console.error("stop exception", e);
    }
    return { error: null };
  }

  async resume() {
    try {
      return await this.robot.resume();
    } catch (e) {
      console.error("resume exception", e);
    }
    return { error: null };
  }

  // empty vacuum to bin
  async evac() {
    try {
      return await this.robot.evac();
    } catch (e) {
      console.error("evac exception", e);
    }
    return { error: null };
  }

  async dock() {
    // before dock, you need to pause or stop the robot
    try {
      return await this.robot.pause();
    } catch (e) {}
    try {
      return await this.robot.dock();
    } catch (e) {
      console.error("dock exception", e);
    }
    return { error: null };
  }
}

const iRobots = {};

const main = async () => {
  if (!MQTT_HOST) {
    console.log("ENV variable MQTT_HOST not found");
    process.exit(1);
  }
  const Config = await HostBase.config(),
    robots = Config.irobot.robots;

  for (const robot of robots) {
    const ENV = robot.env,
      BLID = process.env[ENV + "BLID"],
      PASSWD = process.env[ENV + "PASSWD"];

    console.log("Monitor robot", robot);
    const instance = (iRobots[robot.name] = new IRobot(robot));
    //   robot.device,
    //   robot.type,
    //   BLID,
    //   PASSWD
    // ));
    instance.run();
  }
};

main();
