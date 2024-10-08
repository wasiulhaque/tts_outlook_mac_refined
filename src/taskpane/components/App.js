import * as React from "react";
import PropTypes from "prop-types";
import Header from "./Header";
import ToggleButton from "@mui/material/ToggleButton";
import ToggleButtonGroup from "@mui/material/ToggleButtonGroup";
import Radio from "@mui/material/Radio";
import RadioGroup from "@mui/material/RadioGroup";
import FormControlLabel from "@mui/material/FormControlLabel";
import Box from "@mui/material/Box";
import Slider from "@mui/material/Slider";
import Typography from "@mui/material/Typography";
import bnAnsiToUnicode from "bn-ansi-to-unicode";
import Button from "@mui/material/Button";
import PlayArrowOutlinedIcon from "@mui/icons-material/PlayArrowOutlined";
import ClearOutlinedIcon from "@mui/icons-material/ClearOutlined";
import FileDownloadOutlinedIcon from "@mui/icons-material/FileDownloadOutlined";
import FormHelperText from "@mui/material/FormHelperText";
import FormControl from "@mui/material/FormControl";
import Select, { SelectChangeEvent } from "@mui/material/Select";
import InputLabel from "@mui/material/InputLabel";
import MenuItem from "@mui/material/MenuItem";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import PauseOutlinedIcon from "@mui/icons-material/PauseOutlined";
import StopOutlinedIcon from "@mui/icons-material/StopOutlined";
import { BorderAll } from "@mui/icons-material";
import { fileToAudioBuffer, mergeAudioBuffers } from "./../../modules/chunkify";
import { async } from "regenerator-runtime";
import io from "socket.io-client";
import Crunker from "crunker";

const containerStyle = {
  backgroundColor: "white",
  minHeight: "100vh",
};

const theme = createTheme({
  palette: {
    accent: {
      main: "#389E0D",
      dark: "389E0D",
      contrastText: "#fff",
    },
    secondary: {
      main: "#F5222D",
      dark: "#F5222D",
      contrastText: "#fff",
    },
    download: {
      main: "#136EE5",
      dark: "#136EE5",
      contrastText: "#fff",
    },
    pause: {
      main: "#7CB305",
      dark: "#7CB305",
      contrastText: "#fff",
    },
    stop: {
      main: "#CF1322",
      dark: "#CF1322",
      contrastText: "#fff",
    },
  },
  overrides: {
    MuiButton: {
      root: {
        "&:hover": {
          backgroundColor: "#fff", // Change this to your desired hover color
        },
      },
    },
  },
});

let MAX_WORD_COUNT = 1000;
let MAX_TIMEOUT_RETRY = 5;
let responseAudios = {};
let responseBuffers = [];

let playing = false;
let finishedPlaying = false;
let playerIndex = 0;

let isPlaying = false;

/**
 * Values for the sliders
 */
const ranges = [
  {
    value: -2,
    label: "-২x",
  },
  {
    value: -1,
    label: "-১x",
  },
  {
    value: 0,
    label: "০x",
  },
  {
    value: 1,
    label: "১x",
  },
  {
    value: 2,
    label: "২x",
  },
];

function valuetext(value) {
  return `${value}°C`;
}

export default class App extends React.Component {
  constructor(props, context) {
    super(props, context);
    this.state = {
      listItems: [],
      type: null,
      format: "unicode",
      gender: "male",
      age: null,
      speed: 0,
      pitch: 0,
      responseAudio: null,
      playableAudio: null,
      textToPlay: null,
      downloadActivate: false,
      currentlyPlaying: false,
      startedPlaying: false,
      globalText: null,
      isSocketConnected: false,
    };
  }

  initializeSocket = () => {
    this.socket = io("https://read.bangla.gov.bd:9395", { transports: ["websocket"] });
    this.socket.on("connect", () => {
      console.log("Connected to the server");
      this.setState({ isSocketConnected: true });
    });
    this.socket.on("disconnect", () => {
      console.log("Disconnected from the server");
      this.setState({ isSocketConnected: false });
    });
    this.socket.on("result", (data) => {
      const {index, audio} = data;
      console.log(`Received response for ${index}`);
      
      if (audio){
        responseBuffers[index] = audio;
        const audioSrc = `data:audio/wav;base64,${audio}`;
        const audioElement = new Audio(audioSrc);
        console.log(`Created audio blob players for ${index}`);
        responseAudios[index] = audioElement;

        if (index == 0) {
          this.setState({ currentlyPlaying: true, downloadActivate: false });
          this.triggerPlayback();
        }
      } else{
        console.log("Error: No audio data received for index", index);
      }
    });
  }

  base64ToBlob = (base64Data) => {
    console.log("Converting base64 to blob");
    const binaryString = window.atob(base64Data);
    const byteArray = new Uint8Array(binaryString.length);

    for (let i = 0; i < binaryString.length; i++) {
      byteArray[i] = binaryString.charCodeAt(i);
    }
    console.log("Conversion done");
    return new Blob([byteArray], { type: "audio/mp3" });
  };

  componentDidMount() {
    this.setState({
      listItems: [],
    });
    if (this.state.isSocketConnected == false) {
      this.initializeSocket();
    }
  }

  /**
   * Handler for Type Button
   * Chooses between TEXT and SSML
   */
  handleTypeButton = (event, newType) => {
    this.setState({ type: newType });
    this.type = newType;
    console.log(newType);
  };

  /**
   * Handler for Format Button
   * Chooses between ANSI and UNICODE
   */
  handleFormatButton = (event, newFormat) => {
    this.setState({ format: newFormat });
    this.format = newFormat;
    console.log(this.format);
    if (this.format == "ansi") {
      this.convertAllTextToUnicode()
        .then((selectedText) => {
          this.textToPlay = selectedText;
        })
        .catch((error) => {
          console.log(error);
        });
    } else if (this.format == "unicode") {
      this.grabAllText()
        .then((selectedText) => {
          this.textToPlay = selectedText;
          console.log(this.textToPlay);
          var size = this.textToPlay.length;
          console.log(size);
        })
        .catch((error) => {
          console.log(error);
        });
    }
  };

  /**
   * Handler for Gender Radio Button
   * Chooses between পুরুষ and নারী
   */
  handleGenderChange = (event) => {
    this.setState({ gender: event.target.value });
    this.gender = event.target.value;
    console.log(this.gender);
  };

  /**
   * Handler for Age Radio Button
   * Chooses between  and SSML
   */
  handleAgeChange = (event) => {
    this.setState({ age: event.target.value });
    this.age = event.target.value;
    console.log(this.age);
  };

  /**
   * Handler for গতি Slider
   */
  handleSpeedChange = (event, newValue) => {
    this.setState({ speed: newValue });
    this.speed = newValue;
    console.log(this.speed);
  };

  /**
   * Handler for পিচ Slider
   */
  handlePitchChange = (event) => {
    this.setState({ pitch: event.target.value });
    this.pitch = event.target.value;
    // console.log(this.pitch);
  };

  /**
   * Button handler for Clear Button
   * Clears all the text from the active document
   */
  handleClearButton = () => {
    this.stopAllAudio();
    this.resetVariables();
    this.setState({ currentlyPlaying: false, startedPlaying: false, downloadActivate: false });
  };

  handleDownload = async () => {
    console.log("Download button clicked");
    let audioBuffers = [];
    for (let i = 0; i < Object.keys(responseBuffers).length; i++) {
      audioBuffers.push(this.base64ToBlob(responseBuffers[i]));
    }
    console.log("Audio buffers collected");
    console.log(audioBuffers);
    const crunker = new Crunker({ sampleRate: 22050 });
    crunker
      .fetchAudio(...audioBuffers)
      .then((buffers) => {
        console.log("Audio buffers fetched");
        return crunker.concatAudio(buffers);
      })
      .then((merged) => {
        console.log("Audio buffers merged");
        return crunker.export(merged, "audio/mp3");
      })
      .then((output) => {
        crunker.download(
          output.blob,
          `tts_audio`
        );
        // document.body.append(output.element);
      })
      .catch((error) => {
        console.log("in errror", error);
      });

    crunker.notSupported(() => {
      // Handle no browser support
    });
  };

  /**
   * Grabs all the text from the active document
   */
  grabAllText = async () => {
    return new Promise((resolve, reject) => {
      Office.context.mailbox.item.body.getAsync(Office.CoercionType.Text, (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          const bodyText = result.value;
          resolve(bodyText);
        } else {
          const error = result.error;
          console.log("Error:", error);
          reject(error);
        }
      });
    });
  };

  /**
   * Converts ansi text to unicode
   * @returns unicode string
   */
  convertAllTextToUnicode = async () => {
    return new Promise((resolve, reject) => {
      Office.context.mailbox.item.body.getAsync(Office.CoercionType.Text, (result) => {
        if (result.status === Office.AsyncResultStatus.Succeeded) {
          const bodyText = result.value;
          var allText = bodyText;
          console.log(bnAnsiToUnicode(allText));
          if (this.format == "ansi") {
            return bnAnsiToUnicode(allText);
          } else if (this.format == "unicode") {
            return allText;
          }

          resolve(bodyText);
        } else {
          const error = result.error;
          console.log("Error: ", error);
          reject(error);
        }
      });
    });
  };

  getPlainTextFromWord = async () => {
    await this.grabAllText()
      .then((selectedText) => {
        if (this.format == "ansi") {
          this.textToPlay = bnAnsiToUnicode(selectedText);
        } else {
          this.textToPlay = selectedText;
        }
      })
      .catch((error) => {
        console.log(error);
      });
  };

  splitLongWords = (words, maxWords) => {
    const wordChunks = [];
    let currentWordChunk = "";

    for (const word of words) {
      if ((currentWordChunk + word).split(" ").length <= maxWords) {
        currentWordChunk += word + " ";
      } else {
        if (currentWordChunk !== "") {
          wordChunks.push(currentWordChunk.trim());
          currentWordChunk = "";
        }
        wordChunks.push(word);
      }
    }

    if (currentWordChunk !== "") {
      wordChunks.push(currentWordChunk.trim());
    }
    return wordChunks;
  };

  chunkifyPlainText() {
    return this.textToPlay.split(/[\r\n।?!,;—:`’‘']+/gi).filter((token) => token.trim() != "");
  }

  async triggerPlayback() {
    if (responseAudios !== null) {
      for (; playerIndex < responseAudios.length; playerIndex++) {
        if (responseAudios[playerIndex] != null) {
          await new Promise((resolve) => {
            responseAudios[playerIndex].onended = resolve;
            responseAudios[playerIndex].play();
          });
        } else {
          continue;
        }
      }
      this.setState({ currentlyPlaying: false, downloadActivate: true, startedPlaying: false });
    }
  }

  /**
   * Takes the text from the text, chunks it in the necessary manner, sends the chunks to the server
   * Recieves the response from the server and plays the audios synchronously
   */
  processTextAndPlayAudio = async () => {
    console.log(this.state.startedPlaying);
    if (this.state.currentlyPlaying == false && this.state.startedPlaying == false) {
      console.log("Here");
      this.resetVariables();
      this.textToPlay = null;
      await this.getPlainTextFromWord();
      await this.playNextChunk();
    } else if (this.state.currentlyPlaying == true && this.state.startedPlaying == true) {
      this.pauseAllAudio();
    } else if (this.state.currentlyPlaying == false && this.state.startedPlaying == true) {
      this.setState({ currentlyPlaying: true });
      this.triggerPlayback();
    }
  };

  playNextChunk = async () => {
    this.setState({ currentlyPlaying: true, downloadActivate: false, startedPlaying: true });

    const chunks = this.chunkifyPlainText();
    let index = 0;
    for (const [chunk_index, chunk] of chunks.entries()) {
      const words = chunk.trim().split(" ");
      console.log(words.length);
      if (words.length > MAX_WORD_COUNT) {
        console.log("Max word count reached");
        const wordChunks = this.splitLongWords(words, MAX_WORD_COUNT);
        for (const wordChunk of wordChunks) {
          const chunkIndex = index;
          this.socket.emit("text_transmit", {
            text: wordChunk,
            model: "vits",
            gender: this.state.gender,
            index: chunkIndex,
            speaker: this.state.gender=="male"?"2":"0"
          })
          index = index + 1;
        }
      } else {
          console.log("Sending chunk to server: ", index + chunk_index, chunk);
          this.socket.emit("text_transmit", {
            text: chunk,
            model: "vits",
            gender: this.state.gender,
            index: index + chunk_index,
            speaker: this.state.gender=="male"?"2":"0"
          })
      }
    }
  };

  pauseAllAudio() {
    this.setState({ currentlyPlaying: false });
    for (const audioElement of responseAudios) {
      audioElement.pause();
    }
  }

  stopAllAudio() {
    this.setState({ currentlyPlaying: false, downloadActivate: false });
    for (const audioElement of responseAudios) {
      audioElement.pause();
      audioElement.currentTime = 0;
      playerIndex = 0;
    }
    this.resetVariables();
  }

  resetVariables() {
    responseAudios = [];
    playerIndex = 0;
  }

  render() {
    const { type, format, gender, downloadActivate, currentlyPlaying, startedPlaying } = this.state;

    return (
      <ThemeProvider theme={theme}>
        <div style={containerStyle}>
          <div className="ms-welcome__main">
            <Header logo={require("./../../../assets/logo-filled.png")} title={this.props.title} />
            {/* <div className="button-container">
          <ToggleButtonGroup value={type} exclusive onChange={this.handleTypeButton}>
            <ToggleButton value="text" aria-label="TEXT" className="ms-welcome__action ms-button-uniform">
              TEXT
            </ToggleButton>
            <ToggleButton value="ssml" aria-label="SSML" className="ms-welcome__action ms-button-uniform">
              SSML
            </ToggleButton>
          </ToggleButtonGroup>
        </div> */}

            {/* <div className="square">
            {/* <div className="square">
              <div className="caption">অক্ষরসেট</div>
              <div className="button-container">
                <ToggleButtonGroup value={format} exclusive onChange={this.handleFormatButton}>
                  <ToggleButton
                    value="ansi"
                    aria-label="ANSI"
                    className="ms-welcome__action ms-button-uniform"
                    style={{
                      height: "40px",
                      color: format === "ansi" ? "white" : "black",
                      backgroundColor: format === "ansi" ? "#006def" : "inherit",
                      borderTopLeftRadius: "8px",
                      borderBottomLeftRadius: "8px",
                      width: "80px",
                    }}
                  >
                    ANSI
                  </ToggleButton>
                  <ToggleButton
                    value="unicode"
                    aria-label="UNICODE"
                    className="ms-welcome__action ms-button-uniform"
                    style={{
                      height: "40px",
                      color: format === "unicode" ? "white" : "black",
                      backgroundColor: format == "unicode" ? "#006def" : "inherit",
                      borderTopRightRadius: "8px",
                      borderBottomRightRadius: "8px",
                      width: "80px",
                    }}
                  >
                    UNICODE
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>
            </div> */}

            <div className="square" style={{ marginTop: "30px", marginBottom: "20px" }}>
              <div className="caption">কন্ঠ</div>
              <div className="button-container">
                <ToggleButtonGroup value={gender} exclusive onChange={this.handleGenderChange} disabled={currentlyPlaying || startedPlaying}>
                  <ToggleButton
                    value="male"
                    aria-label="পুরুষ"
                    className="ms-welcome__action ms-button-uniform"
                    style={{
                      height: "40px",
                      color: gender === "male" ? "white" : "black",
                      backgroundColor: gender === "male" ? "#006def" : "inherit",
                      borderTopLeftRadius: "8px",
                      borderBottomLeftRadius: "8px",
                      width: "80px",
                    }}
                  >
                    পুরুষ
                  </ToggleButton>
                  <ToggleButton
                    value="female"
                    aria-label="নারী"
                    className="ms-welcome__action ms-button-uniform"
                    style={{
                      height: "40px",
                      color: gender === "female" ? "white" : "black",
                      backgroundColor: gender == "female" ? "#006def" : "inherit",
                      borderTopRightRadius: "8px",
                      borderBottomRightRadius: "8px",
                      width: "80px",
                    }}
                  >
                    নারী
                  </ToggleButton>
                </ToggleButtonGroup>
              </div>
            </div>
            {/* <div className="button-container">
          <RadioGroup row aria-labelledby="radio-buttons-group-gender-label" name="radio-buttons-group-gender">
            <FormControlLabel value="male" control={<Radio />} label="পুরুষ" onChange={this.handleGenderChange} />
            <FormControlLabel value="female" control={<Radio />} label="নারী" onChange={this.handleGenderChange} />
          </RadioGroup>
        </div>

        <div className="button-container">
          <RadioGroup row aria-labelledby="radio-buttons-group-gender-label" name="radio-buttons-group-gender">
            <FormControlLabel value="adult" control={<Radio />} label="প্রাপ্তবয়স্ক" onChange={this.handleAgeChange} />
            <FormControlLabel value="child" control={<Radio />} label="অপ্রাপ্তবয়স্ক" onChange={this.handleAgeChange} />
          </RadioGroup>
        </div> */}

            {/* <div>
            <Box sx={{ width: 200 }} className="button-container">
              <Typography id="speed-slider" gutterBottom>
                গতি
              </Typography>
              <Slider
                track={false}
                max={2}
                min={-2}
                aria-label="Always visible"
                defaultValue={0}
                getAriaValueText={valuetext}
                step={1}
                marks={ranges}
                valueLabelDisplay="off"
                onChange={this.handleSpeedChange}
              />
            </Box>
          </div> */}
{/*
            <div style={{ display: "flex" }}>
              <div style={{ display: "flex", alignItems: "center", marginRight: "10px" }}>
                <Typography id="speed-slider">গতি</Typography>
                <FormControl sx={{ m: 1, minWidth: 80, minHeight: 30 }} size="small">
                  <Select
                    value={this.speed}
                    defaultValue={0}
                    onChange={this.handleSpeedChange}
                    inputProps={{ "aria-label": "Without label" }}
                  >
                    <MenuItem value={-2}>-২x</MenuItem>
                    <MenuItem value={-1}>-১x</MenuItem>
                    <MenuItem value={0}>০x</MenuItem>
                    <MenuItem value={1}>১x</MenuItem>
                    <MenuItem value={2}>২x</MenuItem>
                  </Select>
                </FormControl>
              </div>

              <div style={{ display: "flex", alignItems: "center", marginLeft: "10px" }}>
                <Typography id="speed-slider">পিচ</Typography>
                <FormControl sx={{ m: 1, minWidth: 80, minHeight: 30 }} size="small">
                  <Select
                    defaultValue={0}
                    value={this.speed}
                    onChange={this.handlePitchChange}
                    inputProps={{ "aria-label": "Without label" }}
                  >
                    <MenuItem value="-2">-২x</MenuItem>
                    <MenuItem value={-1}>-১x</MenuItem>
                    <MenuItem value={0}>০x</MenuItem>
                    <MenuItem value={1}>১x</MenuItem>
                    <MenuItem value={2}>২x</MenuItem>
                  </Select>
                </FormControl>
              </div>
            </div>
            {/* <div>
            <Box sx={{ width: 200 }} className="button-container">
              <Typography id="pitch-slider" gutterBottom>
                পিচ
              </Typography>
              <Slider
                track={false}
                max={2}
                min={-2}
                aria-label="Always visible"
                defaultValue={0}
                getAriaValueText={valuetext}
                step={1}
                marks={ranges}
                valueLabelDisplay="off"
                onChange={this.handlePitchChange}
              />
            </Box>
          </div> */}

            <div className="button-container-bottom" style={{ alignItems: "center" }}>
              <div className="left-buttons">
                <Button
                  variant="contained"
                  size="large"
                  onClick={this.processTextAndPlayAudio}
                  color={currentlyPlaying == false ? "accent" : "pause"}
                  style={{ borderRadius: "8px", height: "40px", width: "70px" }}
                >
                  {currentlyPlaying == false ? <PlayArrowOutlinedIcon /> : <PauseOutlinedIcon />}
                  {/* {currentlyPlaying == false ? "Play" : "Pause"} */}
                </Button>
                <Button
                  variant="contained"
                  size="large"
                  onClick={this.handleClearButton}
                  color="stop"
                  style={{ borderRadius: "8px", height: "40px", width: "70px" }}
                  disabled={!currentlyPlaying && !startedPlaying} 
                >
                  <StopOutlinedIcon />
                  {/* Clear */}
                </Button>
              </div>
              {/* <Button
              {/* <Button
                variant="contained"
                size="small"
                onClick={this.handleDownload}
                color="download"
                style={{ borderRadius: "8px", height: "40px", width: "100px" }}
                disabled={!downloadActivate}
              >
                <FileDownloadOutlinedIcon />
              </Button> */}
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }
}

App.propTypes = {
  title: PropTypes.string,
  isOfficeInitialized: PropTypes.bool,
};
