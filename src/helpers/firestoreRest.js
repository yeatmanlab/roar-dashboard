import _fromPairs from "lodash/fromPairs";
import _last from "lodash/last";
import _mapValues from "lodash/mapValues";
import _toPairs from "lodash/toPairs";
import _without from "lodash/without";

export const convertValues = (value) => {
  const passThroughKeys = [
    "nullValue",
    "booleanValue",
    "integerValue",
    "doubleValue",
    "timestampValue",
    "stringValue",
    "bytesValue",
    "referenceValue",
    "geoPointValue",
  ]
  return _toPairs(value).map(([key, _value]) => {
    if (passThroughKeys.includes(key)) {
      return _value;
    } else if (key === "arrayValue") {
      return (_value.values ?? []).map((itemValue) => convertValues(itemValue));
    } else if (key === "mapValue") {
      return _fromPairs(_toPairs(_value.fields).map(
        ([mapKey, mapValue]) => [mapKey, convertValues(mapValue)]
      ));
    }
  })[0];
}

export const mapFields = (data) => {
  const fields = _without(data.map((item) => {
    if (item.document?.fields) {
      return {
        ...item.document?.fields,
        id: { stringValue: _last(item.document?.name.split("/")) },
      }
    }
    return undefined;
  }), undefined);
  console.log("in mapFields", fields);
  return fields.map((item) => _mapValues(item, (value) => convertValues(value)));
}