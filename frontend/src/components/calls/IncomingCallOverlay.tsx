import React from "react";
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
} from "react-native";

import { useIncomingCall } from "@/src/context/IncomingCallContext";

export default function IncomingCallOverlay() {
  const {
    call,
    hideCall,
    onAccept,
    onReject,
} = useIncomingCall();

  if (!call) return null;

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.overlay}>

        <Text style={styles.label}>
          Incoming Voice Call
        </Text>

        {call.caller_photo ? (
          <Image
            source={{ uri: call.caller_photo }}
            style={styles.avatar}
          />
        ) : (
          <View style={styles.avatar} />
        )}

        <Text style={styles.name}>
          {call.caller_name || "Unknown"}
        </Text>

        <Text style={styles.username}>
          @{call.caller_username || "user"}
        </Text>

        <View style={styles.row}>

          <TouchableOpacity
            style={[styles.btn,{backgroundColor:"#E53935"}]}
            onPress={() => {
              onReject?.();
              hideCall();
            }}
          >
            <Text style={styles.btnText}>
              Reject
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btn,{backgroundColor:"#27AE60"}]}
            onPress={() => {
              onAccept?.();
              hideCall();
            }}
          >
            <Text style={styles.btnText}>
              Accept
            </Text>
          </TouchableOpacity>

        </View>

      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay:{
    flex:1,
    backgroundColor:"#000",
    justifyContent:"center",
    alignItems:"center",
    padding:24,
  },

  label:{
    color:"#AAA",
    fontSize:18,
    marginBottom:30,
  },

  avatar:{
    width:120,
    height:120,
    borderRadius:60,
    backgroundColor:"#333",
  },

  name:{
    color:"#FFF",
    fontSize:28,
    fontWeight:"900",
    marginTop:22,
  },

  username:{
    color:"#AAA",
    marginTop:8,
    fontSize:17,
  },

  row:{
    flexDirection:"row",
    marginTop:60,
    gap:25,
  },

  btn:{
    width:120,
    height:55,
    borderRadius:28,
    justifyContent:"center",
    alignItems:"center",
  },

  btnText:{
    color:"#FFF",
    fontWeight:"800",
    fontSize:17,
  },
});
