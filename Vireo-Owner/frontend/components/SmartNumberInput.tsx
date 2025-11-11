import React, { useState, useEffect } from 'react';
import {
  TextInput,
  StyleSheet,
  TextInputProps,
  NativeSyntheticEvent,
  TextInputKeyPressEventData,
} from 'react-native';
import { COLORS, FONT_SIZE, SPACING, BORDER_RADIUS } from '../constants/theme';

interface SmartNumberInputProps extends Omit<TextInputProps, 'value' | 'onChangeText' | 'onChange'> {
  value: number | null;
  onChange: (val: number | null) => void;
  placeholder?: string;
  allowDecimal?: boolean;
  allowNegative?: boolean;
  maxDecimalPlaces?: number;
  required?: boolean;
}

export default function SmartNumberInput({
  value,
  onChange,
  placeholder = '0',
  allowDecimal = true,
  allowNegative = false,
  maxDecimalPlaces = 3,
  required = false,
  style,
  ...rest
}: SmartNumberInputProps) {
  // Internal string state for typing
  const [rawText, setRawText] = useState<string>('');

  // Sync external value to internal text on mount or external change
  useEffect(() => {
    if (value === null) {
      setRawText('');
    } else {
      setRawText(String(value));
    }
  }, [value]);

  const handleTextChange = (text: string) => {
    // Allow empty string
    if (text === '') {
      setRawText('');
      return;
    }

    // Build regex pattern based on props
    let pattern = '^';
    if (allowNegative) {
      pattern += '-?';
    }
    pattern += '\\d*';
    if (allowDecimal) {
      pattern += '\\.?\\d*';
    }
    pattern += '$';

    const regex = new RegExp(pattern);

    // Only update if valid pattern
    if (regex.test(text)) {
      setRawText(text);
    }
  };

  const handleBlur = () => {
    validateAndCommit();
  };

  const handleKeyPress = (e: NativeSyntheticEvent<TextInputKeyPressEventData>) => {
    if (e.nativeEvent.key === 'Enter') {
      validateAndCommit();
    }
  };

  const validateAndCommit = () => {
    // Handle empty string
    if (rawText === '' || rawText === '-' || rawText === '.') {
      if (required) {
        const committedValue = 0;
        setRawText(String(committedValue));
        onChange(committedValue);
      } else {
        setRawText('');
        onChange(null);
      }
      return;
    }

    // Parse the number
    const parsed = parseFloat(rawText);

    // Check if valid
    if (isNaN(parsed)) {
      // Revert to last valid value
      if (value === null) {
        setRawText('');
      } else {
        setRawText(String(value));
      }
      return;
    }

    // Clamp decimal places
    const clamped = allowDecimal
      ? parseFloat(parsed.toFixed(maxDecimalPlaces))
      : Math.round(parsed);

    // Update both internal and external state
    setRawText(String(clamped));
    onChange(clamped);
  };

  return (
    <TextInput
      style={[styles.input, style]}
      value={rawText}
      onChangeText={handleTextChange}
      onBlur={handleBlur}
      onKeyPress={handleKeyPress}
      placeholder={placeholder}
      placeholderTextColor={COLORS.gray600}
      keyboardType="numeric"
      returnKeyType="done"
      {...rest}
    />
  );
}

const styles = StyleSheet.create({
  input: {
    borderWidth: 1,
    borderColor: COLORS.gold,
    borderRadius: BORDER_RADIUS.md,
    padding: SPACING.md,
    fontSize: FONT_SIZE.md,
    color: COLORS.teal,
    backgroundColor: COLORS.white,
  },
});

// ============================================
// USAGE EXAMPLE WITH REACT HOOK FORM
// ============================================
/*
import { Controller, useForm } from 'react-hook-form';
import SmartNumberInput from './components/SmartNumberInput';

interface FormData {
  quantity: number | null;
  price: number | null;
}

export default function ExampleScreen() {
  const { control, handleSubmit } = useForm<FormData>({
    defaultValues: {
      quantity: null,
      price: null,
    },
  });

  const onSubmit = (data: FormData) => {
    console.log('Quantity:', data.quantity);
    console.log('Price:', data.price);
  };

  return (
    <View style={{ padding: 20 }}>
      <Text style={{ marginBottom: 8, fontWeight: '600' }}>Quantity (Integer Only)</Text>
      <Controller
        control={control}
        name="quantity"
        rules={{ required: 'Quantity is required' }}
        render={({ field: { onChange, value } }) => (
          <SmartNumberInput
            value={value}
            onChange={onChange}
            placeholder="Enter quantity"
            allowDecimal={false}
            required={true}
          />
        )}
      />

      <Text style={{ marginTop: 16, marginBottom: 8, fontWeight: '600' }}>
        Price (2 Decimal Places)
      </Text>
      <Controller
        control={control}
        name="price"
        render={({ field: { onChange, value } }) => (
          <SmartNumberInput
            value={value}
            onChange={onChange}
            placeholder="0.00"
            allowDecimal={true}
            maxDecimalPlaces={2}
            required={false}
          />
        )}
      />

      <TouchableOpacity
        style={{
          backgroundColor: '#0EA5E9',
          padding: 16,
          borderRadius: 8,
          marginTop: 20,
        }}
        onPress={handleSubmit(onSubmit)}
      >
        <Text style={{ color: 'white', textAlign: 'center', fontWeight: '600' }}>Submit</Text>
      </TouchableOpacity>
    </View>
  );
}
*/
