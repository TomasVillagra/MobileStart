
import React, { useState } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors } from './theme';

export default function LabeledInput({
  label,
  icon,
  placeholder,
  secure=false,
  value,
  onChangeText
}) {
  const [hidden, setHidden] = useState(secure);
  return (
    <View style={{ marginBottom: 18 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
        <Ionicons name={icon} size={18} color={colors.text} style={{ marginRight: 8 }} />
        <Text style={styles.label}>{label}</Text>
      </View>
      <View style={styles.inputWrapper}>
        <TextInput
          placeholder={placeholder}
          placeholderTextColor={colors.placeholder}
          secureTextEntry={hidden}
          value={value}
          onChangeText={onChangeText}
          style={styles.input}
        />
        {secure && (
          <Pressable onPress={() => setHidden(!hidden)} hitSlop={10}>
            <Ionicons name={hidden ? 'eye-off' : 'eye'} size={20} color={colors.text} />
          </Pressable>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  label: {
    color: colors.text,
    fontSize: 14,
    fontWeight: '600'
  },
  inputWrapper: {
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  input: {
    flex: 1,
    fontSize: 15,
    marginRight: 8,
    color: '#222'
  }
});
