import React, { useEffect, useRef, useState } from 'react';
import { useBeforeunload } from 'react-beforeunload';
import styled from 'styled-components';
import Peer from 'simple-peer';
import io from 'socket.io-client';

const Video = styled.video`
	height: 20rem;
	margin: 2rem;
	border-radius: 1rem;
	cursor: default;

	&:hover {
		-webkit-box-shadow: 0px 0px 21px 15px rgba(0, 0, 0, 0.15);
		-moz-box-shadow: 0px 0px 21px 15px rgba(0, 0, 0, 0.15);
		box-shadow: 0px 0px 21px 15px rgba(0, 0, 0, 0.15);
		transform: scaleX(1.05) scaleY(1.05);
		transform-origin: bottom;
	}
`;

const Container = styled.div`
	width: 100vw;
	height: 100vh;
	display: flex;
	flex-direction: column;
	justify-content: start;
	align-items: center;
`;

const CallerContainer = styled.div`
	display: flex;
	flex-direction: column;
	justify-content: center;
`;

const CallButton = styled.button`
	margin: 1rem;
	padding: 0.8rem;
	border-radius: 2rem;
	border-width: 0rem;
	cursor: pointer;

	&:hover {
		-webkit-box-shadow: 0px 0px 21px 15px rgba(0, 0, 0, 0.15);
		-moz-box-shadow: 0px 0px 21px 15px rgba(0, 0, 0, 0.15);
		box-shadow: 0px 0px 21px 15px rgba(0, 0, 0, 0.15);
		transform: scaleX(1.05) scaleY(1.05);
		transform-origin: bottom;
	}

	&:focus {
		outline: none;
	}
`;

const RecievingCallButton = styled.button`
	margin: 1rem;
	padding: 0.8rem;
	border-radius: 2rem;
	border-width: 0rem;
	color: white;
	background-color: darkolivegreen;
	cursor: pointer;

	&:hover {
		-webkit-box-shadow: 0px 0px 21px 15px rgba(0, 0, 0, 0.15);
		-moz-box-shadow: 0px 0px 21px 15px rgba(0, 0, 0, 0.15);
		box-shadow: 0px 0px 21px 15px rgba(0, 0, 0, 0.15);
		transform: scaleX(1.05) scaleY(1.05);
		transform-origin: bottom;
	}

	&:focus {
		outline: none;
	}
`;

const VideoContainer = styled.div`
	display: flex;
	justify-content: space-between;
`;

const BlankContainer = styled.div`
	background-color: gray;
	display: flex;
	align-items: center;
	justify-content: center;
	border-radius: 1rem;
	font-size: 2rem;
	height: 20rem;
	width: 28rem;
	margin: 2rem;
	cursor: default;

	&:hover {
		-webkit-box-shadow: 0px 0px 21px 15px rgba(0, 0, 0, 0.15);
		-moz-box-shadow: 0px 0px 21px 15px rgba(0, 0, 0, 0.15);
		box-shadow: 0px 0px 21px 15px rgba(0, 0, 0, 0.15);
		transform: scaleX(1.05) scaleY(1.05);
		transform-origin: bottom;
	}
`;

function App() {
	const [stream, setStream] = useState(null);
	const [myID, setMyID] = useState();
	const [onlineUsers, setOnlineUsersList] = useState({});
	const [callWithId, setCallWithId] = useState('');
	const [receivingCall, setReceivingCall] = useState(false);
	const [callerSignal, setCallerSignal] = useState();
	const [callAccepted, setCallAccepted] = useState(false);
	const [, setConnectedPeer] = useState();

	const socket = useRef();
	const userVideo = useRef();
	const partnerVideo = useRef();

	// Use for cleaning up
	useBeforeunload(hangUp);

	/////////

	const [seconds, setSeconds] = useState(0);
	const [isActive, setIsActive] = useState(false);

	function timerToggle() {
		setIsActive(!isActive);
	}

	function timerReset() {
		setSeconds(0);
		setIsActive(false);
	}

	useEffect(() => {
		let interval = null;
		if (isActive) {
			interval = setInterval(() => {
				setSeconds((seconds) => seconds + 1);
			}, 1000);
		} else if (!isActive && seconds !== 0) {
			clearInterval(interval);
		}
		return () => clearInterval(interval);
	}, [isActive, seconds]);

	//////////

	useEffect(() => {
		socket.current = io.connect('localhost:5000');
		navigator.mediaDevices
			.getUserMedia({ video: true, audio: true })
			.then((stream) => {
				setStream(stream);
				if (userVideo.current) {
					userVideo.current.srcObject = stream;
				}
			});
		socket.current.on('id_report', (id) => {
			setMyID(id);
		});
		socket.current.on('online_users_report', (users) => {
			setOnlineUsersList(users);
		});
		socket.current.on('someone_calling', (data) => {
			setReceivingCall(true);
			setCallWithId(data.from);
			setCallerSignal(data.signal);
		});
	}, []);

	function callPeer(id) {
		const peer = new Peer({
			initiator: true,
			trickle: false,
			stream: stream,
		});

		peer.on('signal', (data) => {
			socket.current.emit('call_someone', {
				callId: id,
				data: data,
				callerId: myID,
			});
		});

		peer.on('stream', (stream) => {
			if (partnerVideo.current) {
				partnerVideo.current.srcObject = stream;
			}
		});

		socket.current.on('call_accepted', (signal) => {
			timerToggle();
			setCallWithId(id);
			setCallAccepted(true);
			peer.signal(signal);
		});

		socket.current.on('hang_up', () => {
			PartnerVideo = null;
			setCallAccepted(false);
			timerReset();
			setReceivingCall(false);
			setCallWithId('');
		});

		setConnectedPeer(peer);
	}

	function acceptCall() {
		timerToggle();
		setCallAccepted(true);
		setReceivingCall(false);
		const peer = new Peer({
			initiator: false,
			trickle: false,
			stream: stream,
		});
		peer.on('signal', (data) => {
			socket.current.emit('accept_calling', {
				signal: data,
				to: callWithId,
			});
		});

		peer.on('stream', (stream) => {
			partnerVideo.current.srcObject = stream;
		});

		peer.signal(callerSignal);

		socket.current.emit('call_initiate', {
			callId: callWithId,
			callerId: myID,
		});

		socket.current.on('hang_up', () => {
			PartnerVideo = null;
			setCallAccepted(false);
			setReceivingCall(false);
			setCallWithId('');
			timerReset();
		});

		setConnectedPeer(peer);
	}

	function hangUp() {
		PartnerVideo = null;
		setCallWithId('');
		setReceivingCall(false);
		setCallerSignal(null);
		setCallAccepted(false);
		setConnectedPeer(null);
		timerReset();
		socket.current.emit('end_call', {
			id: myID,
			elapseTime: seconds,
		});
	}

	let UserVideo;
	if (stream) {
		UserVideo = <Video playsInline muted ref={userVideo} autoPlay />;
	}

	let PartnerVideo;
	if (callAccepted) {
		PartnerVideo = <Video playsInline ref={partnerVideo} autoPlay />;
	}

	return (
		<Container>
			<h1>HCRL - Socke(t) Talky! 🥳</h1>
			<p>Powered by WebRTC</p>
			{stream && (
				<VideoContainer>
					{UserVideo}
					{PartnerVideo ? (
						PartnerVideo
					) : (
						<BlankContainer>
							No one here yet! 🤨
						</BlankContainer>
					)}
				</VideoContainer>
			)}

			{!callAccepted && (
				<CallerContainer>
					{Object.values(onlineUsers).map((user) => {
						if (user.id !== myID) {
							return (
								<CallButton
									key={user.id}
									onClick={() => callPeer(user.id)}
								>{`Call ${user.id}`}</CallButton>
							);
						}
						return null;
					})}
				</CallerContainer>
			)}
			{receivingCall && !callAccepted && (
				<>
					<p>{callWithId} is calling you</p>
					<RecievingCallButton onClick={acceptCall}>
						Accept
					</RecievingCallButton>
				</>
			)}

			{callAccepted && (
				<>
					<p>{`Calling time: ${seconds} second(s)`}</p>
					<p>{`calling with ${callWithId}`}</p>
					<CallButton onClick={hangUp}>{`Hangup`}</CallButton>
				</>
			)}
		</Container>
	);
}

export default App;
