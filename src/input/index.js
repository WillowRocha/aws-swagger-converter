import React from "react";
import styled from "styled-components";

const InputWrapper = styled.div`
  width: 100%;
`;

const LabelWrapper = styled.div`
  opacity: 0.9;
  font-size: 12px;
  line-height: 1.17;
  text-align: left;
  color: #747576;
  margin-bottom: 3.3px;
`;

const TextInput = styled.input`
  width: 100%;
  border: none;
  border-radius: 4px;
  background-color: ${({ color }) => (color ? color : "#f6f6f6")};
  padding: 9.5px;

  font-size: 12px;
  font-weight: 500;
  color: #000;
`;

const Input = (props) => {
  const { color, disabled, label, onChange, type, value } = props;

  return (
    <>
      <InputWrapper>
        {label && <LabelWrapper>{label}</LabelWrapper>}
        <TextInput
          color={color}
          disabled={disabled}
          value={value}
          onChange={onChange}
        />
      </InputWrapper>
    </>
  );
};

export default Input;
