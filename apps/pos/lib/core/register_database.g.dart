// GENERATED CODE - DO NOT MODIFY BY HAND

part of 'register_database.dart';

// ignore_for_file: type=lint
class $RegisterInstallationsTable extends RegisterInstallations
    with TableInfo<$RegisterInstallationsTable, RegisterInstallation> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RegisterInstallationsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(1),
  );
  static const VerificationMeta _apiOriginMeta = const VerificationMeta(
    'apiOrigin',
  );
  @override
  late final GeneratedColumn<String> apiOrigin = GeneratedColumn<String>(
    'api_origin',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _businessSlugMeta = const VerificationMeta(
    'businessSlug',
  );
  @override
  late final GeneratedColumn<String> businessSlug = GeneratedColumn<String>(
    'business_slug',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _businessIdMeta = const VerificationMeta(
    'businessId',
  );
  @override
  late final GeneratedColumn<String> businessId = GeneratedColumn<String>(
    'business_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _branchIdMeta = const VerificationMeta(
    'branchId',
  );
  @override
  late final GeneratedColumn<String> branchId = GeneratedColumn<String>(
    'branch_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _profileIdMeta = const VerificationMeta(
    'profileId',
  );
  @override
  late final GeneratedColumn<String> profileId = GeneratedColumn<String>(
    'profile_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    apiOrigin,
    businessSlug,
    businessId,
    branchId,
    profileId,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'register_installations';
  @override
  VerificationContext validateIntegrity(
    Insertable<RegisterInstallation> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('api_origin')) {
      context.handle(
        _apiOriginMeta,
        apiOrigin.isAcceptableOrUnknown(data['api_origin']!, _apiOriginMeta),
      );
    } else if (isInserting) {
      context.missing(_apiOriginMeta);
    }
    if (data.containsKey('business_slug')) {
      context.handle(
        _businessSlugMeta,
        businessSlug.isAcceptableOrUnknown(
          data['business_slug']!,
          _businessSlugMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_businessSlugMeta);
    }
    if (data.containsKey('business_id')) {
      context.handle(
        _businessIdMeta,
        businessId.isAcceptableOrUnknown(data['business_id']!, _businessIdMeta),
      );
    } else if (isInserting) {
      context.missing(_businessIdMeta);
    }
    if (data.containsKey('branch_id')) {
      context.handle(
        _branchIdMeta,
        branchId.isAcceptableOrUnknown(data['branch_id']!, _branchIdMeta),
      );
    } else if (isInserting) {
      context.missing(_branchIdMeta);
    }
    if (data.containsKey('profile_id')) {
      context.handle(
        _profileIdMeta,
        profileId.isAcceptableOrUnknown(data['profile_id']!, _profileIdMeta),
      );
    } else if (isInserting) {
      context.missing(_profileIdMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  RegisterInstallation map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RegisterInstallation(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      apiOrigin: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}api_origin'],
      )!,
      businessSlug: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_slug'],
      )!,
      businessId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}business_id'],
      )!,
      branchId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}branch_id'],
      )!,
      profileId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}profile_id'],
      )!,
    );
  }

  @override
  $RegisterInstallationsTable createAlias(String alias) {
    return $RegisterInstallationsTable(attachedDatabase, alias);
  }
}

class RegisterInstallation extends DataClass
    implements Insertable<RegisterInstallation> {
  final int id;
  final String apiOrigin;
  final String businessSlug;
  final String businessId;
  final String branchId;
  final String profileId;
  const RegisterInstallation({
    required this.id,
    required this.apiOrigin,
    required this.businessSlug,
    required this.businessId,
    required this.branchId,
    required this.profileId,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['api_origin'] = Variable<String>(apiOrigin);
    map['business_slug'] = Variable<String>(businessSlug);
    map['business_id'] = Variable<String>(businessId);
    map['branch_id'] = Variable<String>(branchId);
    map['profile_id'] = Variable<String>(profileId);
    return map;
  }

  RegisterInstallationsCompanion toCompanion(bool nullToAbsent) {
    return RegisterInstallationsCompanion(
      id: Value(id),
      apiOrigin: Value(apiOrigin),
      businessSlug: Value(businessSlug),
      businessId: Value(businessId),
      branchId: Value(branchId),
      profileId: Value(profileId),
    );
  }

  factory RegisterInstallation.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RegisterInstallation(
      id: serializer.fromJson<int>(json['id']),
      apiOrigin: serializer.fromJson<String>(json['apiOrigin']),
      businessSlug: serializer.fromJson<String>(json['businessSlug']),
      businessId: serializer.fromJson<String>(json['businessId']),
      branchId: serializer.fromJson<String>(json['branchId']),
      profileId: serializer.fromJson<String>(json['profileId']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'apiOrigin': serializer.toJson<String>(apiOrigin),
      'businessSlug': serializer.toJson<String>(businessSlug),
      'businessId': serializer.toJson<String>(businessId),
      'branchId': serializer.toJson<String>(branchId),
      'profileId': serializer.toJson<String>(profileId),
    };
  }

  RegisterInstallation copyWith({
    int? id,
    String? apiOrigin,
    String? businessSlug,
    String? businessId,
    String? branchId,
    String? profileId,
  }) => RegisterInstallation(
    id: id ?? this.id,
    apiOrigin: apiOrigin ?? this.apiOrigin,
    businessSlug: businessSlug ?? this.businessSlug,
    businessId: businessId ?? this.businessId,
    branchId: branchId ?? this.branchId,
    profileId: profileId ?? this.profileId,
  );
  RegisterInstallation copyWithCompanion(RegisterInstallationsCompanion data) {
    return RegisterInstallation(
      id: data.id.present ? data.id.value : this.id,
      apiOrigin: data.apiOrigin.present ? data.apiOrigin.value : this.apiOrigin,
      businessSlug: data.businessSlug.present
          ? data.businessSlug.value
          : this.businessSlug,
      businessId: data.businessId.present
          ? data.businessId.value
          : this.businessId,
      branchId: data.branchId.present ? data.branchId.value : this.branchId,
      profileId: data.profileId.present ? data.profileId.value : this.profileId,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RegisterInstallation(')
          ..write('id: $id, ')
          ..write('apiOrigin: $apiOrigin, ')
          ..write('businessSlug: $businessSlug, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('profileId: $profileId')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, apiOrigin, businessSlug, businessId, branchId, profileId);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RegisterInstallation &&
          other.id == this.id &&
          other.apiOrigin == this.apiOrigin &&
          other.businessSlug == this.businessSlug &&
          other.businessId == this.businessId &&
          other.branchId == this.branchId &&
          other.profileId == this.profileId);
}

class RegisterInstallationsCompanion
    extends UpdateCompanion<RegisterInstallation> {
  final Value<int> id;
  final Value<String> apiOrigin;
  final Value<String> businessSlug;
  final Value<String> businessId;
  final Value<String> branchId;
  final Value<String> profileId;
  const RegisterInstallationsCompanion({
    this.id = const Value.absent(),
    this.apiOrigin = const Value.absent(),
    this.businessSlug = const Value.absent(),
    this.businessId = const Value.absent(),
    this.branchId = const Value.absent(),
    this.profileId = const Value.absent(),
  });
  RegisterInstallationsCompanion.insert({
    this.id = const Value.absent(),
    required String apiOrigin,
    required String businessSlug,
    required String businessId,
    required String branchId,
    required String profileId,
  }) : apiOrigin = Value(apiOrigin),
       businessSlug = Value(businessSlug),
       businessId = Value(businessId),
       branchId = Value(branchId),
       profileId = Value(profileId);
  static Insertable<RegisterInstallation> custom({
    Expression<int>? id,
    Expression<String>? apiOrigin,
    Expression<String>? businessSlug,
    Expression<String>? businessId,
    Expression<String>? branchId,
    Expression<String>? profileId,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (apiOrigin != null) 'api_origin': apiOrigin,
      if (businessSlug != null) 'business_slug': businessSlug,
      if (businessId != null) 'business_id': businessId,
      if (branchId != null) 'branch_id': branchId,
      if (profileId != null) 'profile_id': profileId,
    });
  }

  RegisterInstallationsCompanion copyWith({
    Value<int>? id,
    Value<String>? apiOrigin,
    Value<String>? businessSlug,
    Value<String>? businessId,
    Value<String>? branchId,
    Value<String>? profileId,
  }) {
    return RegisterInstallationsCompanion(
      id: id ?? this.id,
      apiOrigin: apiOrigin ?? this.apiOrigin,
      businessSlug: businessSlug ?? this.businessSlug,
      businessId: businessId ?? this.businessId,
      branchId: branchId ?? this.branchId,
      profileId: profileId ?? this.profileId,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (apiOrigin.present) {
      map['api_origin'] = Variable<String>(apiOrigin.value);
    }
    if (businessSlug.present) {
      map['business_slug'] = Variable<String>(businessSlug.value);
    }
    if (businessId.present) {
      map['business_id'] = Variable<String>(businessId.value);
    }
    if (branchId.present) {
      map['branch_id'] = Variable<String>(branchId.value);
    }
    if (profileId.present) {
      map['profile_id'] = Variable<String>(profileId.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RegisterInstallationsCompanion(')
          ..write('id: $id, ')
          ..write('apiOrigin: $apiOrigin, ')
          ..write('businessSlug: $businessSlug, ')
          ..write('businessId: $businessId, ')
          ..write('branchId: $branchId, ')
          ..write('profileId: $profileId')
          ..write(')'))
        .toString();
  }
}

class $RegisterOperatorsTable extends RegisterOperators
    with TableInfo<$RegisterOperatorsTable, RegisterOperator> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RegisterOperatorsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _emailMeta = const VerificationMeta('email');
  @override
  late final GeneratedColumn<String> email = GeneratedColumn<String>(
    'email',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _displayNameMeta = const VerificationMeta(
    'displayName',
  );
  @override
  late final GeneratedColumn<String> displayName = GeneratedColumn<String>(
    'display_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _roleMeta = const VerificationMeta('role');
  @override
  late final GeneratedColumn<String> role = GeneratedColumn<String>(
    'role',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _failedPinsMeta = const VerificationMeta(
    'failedPins',
  );
  @override
  late final GeneratedColumn<int> failedPins = GeneratedColumn<int>(
    'failed_pins',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _blockedUntilMeta = const VerificationMeta(
    'blockedUntil',
  );
  @override
  late final GeneratedColumn<DateTime> blockedUntil = GeneratedColumn<DateTime>(
    'blocked_until',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _accessRevokedMeta = const VerificationMeta(
    'accessRevoked',
  );
  @override
  late final GeneratedColumn<bool> accessRevoked = GeneratedColumn<bool>(
    'access_revoked',
    aliasedName,
    false,
    type: DriftSqlType.bool,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'CHECK ("access_revoked" IN (0, 1))',
    ),
    defaultValue: const Constant(false),
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    email,
    displayName,
    role,
    failedPins,
    blockedUntil,
    accessRevoked,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'register_operators';
  @override
  VerificationContext validateIntegrity(
    Insertable<RegisterOperator> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('email')) {
      context.handle(
        _emailMeta,
        email.isAcceptableOrUnknown(data['email']!, _emailMeta),
      );
    } else if (isInserting) {
      context.missing(_emailMeta);
    }
    if (data.containsKey('display_name')) {
      context.handle(
        _displayNameMeta,
        displayName.isAcceptableOrUnknown(
          data['display_name']!,
          _displayNameMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_displayNameMeta);
    }
    if (data.containsKey('role')) {
      context.handle(
        _roleMeta,
        role.isAcceptableOrUnknown(data['role']!, _roleMeta),
      );
    } else if (isInserting) {
      context.missing(_roleMeta);
    }
    if (data.containsKey('failed_pins')) {
      context.handle(
        _failedPinsMeta,
        failedPins.isAcceptableOrUnknown(data['failed_pins']!, _failedPinsMeta),
      );
    }
    if (data.containsKey('blocked_until')) {
      context.handle(
        _blockedUntilMeta,
        blockedUntil.isAcceptableOrUnknown(
          data['blocked_until']!,
          _blockedUntilMeta,
        ),
      );
    }
    if (data.containsKey('access_revoked')) {
      context.handle(
        _accessRevokedMeta,
        accessRevoked.isAcceptableOrUnknown(
          data['access_revoked']!,
          _accessRevokedMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  RegisterOperator map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RegisterOperator(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      email: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}email'],
      )!,
      displayName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}display_name'],
      )!,
      role: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}role'],
      )!,
      failedPins: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}failed_pins'],
      )!,
      blockedUntil: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}blocked_until'],
      ),
      accessRevoked: attachedDatabase.typeMapping.read(
        DriftSqlType.bool,
        data['${effectivePrefix}access_revoked'],
      )!,
    );
  }

  @override
  $RegisterOperatorsTable createAlias(String alias) {
    return $RegisterOperatorsTable(attachedDatabase, alias);
  }
}

class RegisterOperator extends DataClass
    implements Insertable<RegisterOperator> {
  final String id;
  final String email;
  final String displayName;
  final String role;
  final int failedPins;
  final DateTime? blockedUntil;
  final bool accessRevoked;
  const RegisterOperator({
    required this.id,
    required this.email,
    required this.displayName,
    required this.role,
    required this.failedPins,
    this.blockedUntil,
    required this.accessRevoked,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['email'] = Variable<String>(email);
    map['display_name'] = Variable<String>(displayName);
    map['role'] = Variable<String>(role);
    map['failed_pins'] = Variable<int>(failedPins);
    if (!nullToAbsent || blockedUntil != null) {
      map['blocked_until'] = Variable<DateTime>(blockedUntil);
    }
    map['access_revoked'] = Variable<bool>(accessRevoked);
    return map;
  }

  RegisterOperatorsCompanion toCompanion(bool nullToAbsent) {
    return RegisterOperatorsCompanion(
      id: Value(id),
      email: Value(email),
      displayName: Value(displayName),
      role: Value(role),
      failedPins: Value(failedPins),
      blockedUntil: blockedUntil == null && nullToAbsent
          ? const Value.absent()
          : Value(blockedUntil),
      accessRevoked: Value(accessRevoked),
    );
  }

  factory RegisterOperator.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RegisterOperator(
      id: serializer.fromJson<String>(json['id']),
      email: serializer.fromJson<String>(json['email']),
      displayName: serializer.fromJson<String>(json['displayName']),
      role: serializer.fromJson<String>(json['role']),
      failedPins: serializer.fromJson<int>(json['failedPins']),
      blockedUntil: serializer.fromJson<DateTime?>(json['blockedUntil']),
      accessRevoked: serializer.fromJson<bool>(json['accessRevoked']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'email': serializer.toJson<String>(email),
      'displayName': serializer.toJson<String>(displayName),
      'role': serializer.toJson<String>(role),
      'failedPins': serializer.toJson<int>(failedPins),
      'blockedUntil': serializer.toJson<DateTime?>(blockedUntil),
      'accessRevoked': serializer.toJson<bool>(accessRevoked),
    };
  }

  RegisterOperator copyWith({
    String? id,
    String? email,
    String? displayName,
    String? role,
    int? failedPins,
    Value<DateTime?> blockedUntil = const Value.absent(),
    bool? accessRevoked,
  }) => RegisterOperator(
    id: id ?? this.id,
    email: email ?? this.email,
    displayName: displayName ?? this.displayName,
    role: role ?? this.role,
    failedPins: failedPins ?? this.failedPins,
    blockedUntil: blockedUntil.present ? blockedUntil.value : this.blockedUntil,
    accessRevoked: accessRevoked ?? this.accessRevoked,
  );
  RegisterOperator copyWithCompanion(RegisterOperatorsCompanion data) {
    return RegisterOperator(
      id: data.id.present ? data.id.value : this.id,
      email: data.email.present ? data.email.value : this.email,
      displayName: data.displayName.present
          ? data.displayName.value
          : this.displayName,
      role: data.role.present ? data.role.value : this.role,
      failedPins: data.failedPins.present
          ? data.failedPins.value
          : this.failedPins,
      blockedUntil: data.blockedUntil.present
          ? data.blockedUntil.value
          : this.blockedUntil,
      accessRevoked: data.accessRevoked.present
          ? data.accessRevoked.value
          : this.accessRevoked,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RegisterOperator(')
          ..write('id: $id, ')
          ..write('email: $email, ')
          ..write('displayName: $displayName, ')
          ..write('role: $role, ')
          ..write('failedPins: $failedPins, ')
          ..write('blockedUntil: $blockedUntil, ')
          ..write('accessRevoked: $accessRevoked')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    email,
    displayName,
    role,
    failedPins,
    blockedUntil,
    accessRevoked,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RegisterOperator &&
          other.id == this.id &&
          other.email == this.email &&
          other.displayName == this.displayName &&
          other.role == this.role &&
          other.failedPins == this.failedPins &&
          other.blockedUntil == this.blockedUntil &&
          other.accessRevoked == this.accessRevoked);
}

class RegisterOperatorsCompanion extends UpdateCompanion<RegisterOperator> {
  final Value<String> id;
  final Value<String> email;
  final Value<String> displayName;
  final Value<String> role;
  final Value<int> failedPins;
  final Value<DateTime?> blockedUntil;
  final Value<bool> accessRevoked;
  final Value<int> rowid;
  const RegisterOperatorsCompanion({
    this.id = const Value.absent(),
    this.email = const Value.absent(),
    this.displayName = const Value.absent(),
    this.role = const Value.absent(),
    this.failedPins = const Value.absent(),
    this.blockedUntil = const Value.absent(),
    this.accessRevoked = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  RegisterOperatorsCompanion.insert({
    required String id,
    required String email,
    required String displayName,
    required String role,
    this.failedPins = const Value.absent(),
    this.blockedUntil = const Value.absent(),
    this.accessRevoked = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       email = Value(email),
       displayName = Value(displayName),
       role = Value(role);
  static Insertable<RegisterOperator> custom({
    Expression<String>? id,
    Expression<String>? email,
    Expression<String>? displayName,
    Expression<String>? role,
    Expression<int>? failedPins,
    Expression<DateTime>? blockedUntil,
    Expression<bool>? accessRevoked,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (email != null) 'email': email,
      if (displayName != null) 'display_name': displayName,
      if (role != null) 'role': role,
      if (failedPins != null) 'failed_pins': failedPins,
      if (blockedUntil != null) 'blocked_until': blockedUntil,
      if (accessRevoked != null) 'access_revoked': accessRevoked,
      if (rowid != null) 'rowid': rowid,
    });
  }

  RegisterOperatorsCompanion copyWith({
    Value<String>? id,
    Value<String>? email,
    Value<String>? displayName,
    Value<String>? role,
    Value<int>? failedPins,
    Value<DateTime?>? blockedUntil,
    Value<bool>? accessRevoked,
    Value<int>? rowid,
  }) {
    return RegisterOperatorsCompanion(
      id: id ?? this.id,
      email: email ?? this.email,
      displayName: displayName ?? this.displayName,
      role: role ?? this.role,
      failedPins: failedPins ?? this.failedPins,
      blockedUntil: blockedUntil ?? this.blockedUntil,
      accessRevoked: accessRevoked ?? this.accessRevoked,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (email.present) {
      map['email'] = Variable<String>(email.value);
    }
    if (displayName.present) {
      map['display_name'] = Variable<String>(displayName.value);
    }
    if (role.present) {
      map['role'] = Variable<String>(role.value);
    }
    if (failedPins.present) {
      map['failed_pins'] = Variable<int>(failedPins.value);
    }
    if (blockedUntil.present) {
      map['blocked_until'] = Variable<DateTime>(blockedUntil.value);
    }
    if (accessRevoked.present) {
      map['access_revoked'] = Variable<bool>(accessRevoked.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RegisterOperatorsCompanion(')
          ..write('id: $id, ')
          ..write('email: $email, ')
          ..write('displayName: $displayName, ')
          ..write('role: $role, ')
          ..write('failedPins: $failedPins, ')
          ..write('blockedUntil: $blockedUntil, ')
          ..write('accessRevoked: $accessRevoked, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ProfileSnapshotsTable extends ProfileSnapshots
    with TableInfo<$ProfileSnapshotsTable, ProfileSnapshot> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ProfileSnapshotsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _profileIdMeta = const VerificationMeta(
    'profileId',
  );
  @override
  late final GeneratedColumn<String> profileId = GeneratedColumn<String>(
    'profile_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _refreshedAtMeta = const VerificationMeta(
    'refreshedAt',
  );
  @override
  late final GeneratedColumn<DateTime> refreshedAt = GeneratedColumn<DateTime>(
    'refreshed_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [profileId, payload, refreshedAt];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'profile_snapshots';
  @override
  VerificationContext validateIntegrity(
    Insertable<ProfileSnapshot> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('profile_id')) {
      context.handle(
        _profileIdMeta,
        profileId.isAcceptableOrUnknown(data['profile_id']!, _profileIdMeta),
      );
    } else if (isInserting) {
      context.missing(_profileIdMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('refreshed_at')) {
      context.handle(
        _refreshedAtMeta,
        refreshedAt.isAcceptableOrUnknown(
          data['refreshed_at']!,
          _refreshedAtMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_refreshedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {profileId};
  @override
  ProfileSnapshot map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ProfileSnapshot(
      profileId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}profile_id'],
      )!,
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
      refreshedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}refreshed_at'],
      )!,
    );
  }

  @override
  $ProfileSnapshotsTable createAlias(String alias) {
    return $ProfileSnapshotsTable(attachedDatabase, alias);
  }
}

class ProfileSnapshot extends DataClass implements Insertable<ProfileSnapshot> {
  final String profileId;
  final String payload;
  final DateTime refreshedAt;
  const ProfileSnapshot({
    required this.profileId,
    required this.payload,
    required this.refreshedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['profile_id'] = Variable<String>(profileId);
    map['payload'] = Variable<String>(payload);
    map['refreshed_at'] = Variable<DateTime>(refreshedAt);
    return map;
  }

  ProfileSnapshotsCompanion toCompanion(bool nullToAbsent) {
    return ProfileSnapshotsCompanion(
      profileId: Value(profileId),
      payload: Value(payload),
      refreshedAt: Value(refreshedAt),
    );
  }

  factory ProfileSnapshot.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ProfileSnapshot(
      profileId: serializer.fromJson<String>(json['profileId']),
      payload: serializer.fromJson<String>(json['payload']),
      refreshedAt: serializer.fromJson<DateTime>(json['refreshedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'profileId': serializer.toJson<String>(profileId),
      'payload': serializer.toJson<String>(payload),
      'refreshedAt': serializer.toJson<DateTime>(refreshedAt),
    };
  }

  ProfileSnapshot copyWith({
    String? profileId,
    String? payload,
    DateTime? refreshedAt,
  }) => ProfileSnapshot(
    profileId: profileId ?? this.profileId,
    payload: payload ?? this.payload,
    refreshedAt: refreshedAt ?? this.refreshedAt,
  );
  ProfileSnapshot copyWithCompanion(ProfileSnapshotsCompanion data) {
    return ProfileSnapshot(
      profileId: data.profileId.present ? data.profileId.value : this.profileId,
      payload: data.payload.present ? data.payload.value : this.payload,
      refreshedAt: data.refreshedAt.present
          ? data.refreshedAt.value
          : this.refreshedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ProfileSnapshot(')
          ..write('profileId: $profileId, ')
          ..write('payload: $payload, ')
          ..write('refreshedAt: $refreshedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(profileId, payload, refreshedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ProfileSnapshot &&
          other.profileId == this.profileId &&
          other.payload == this.payload &&
          other.refreshedAt == this.refreshedAt);
}

class ProfileSnapshotsCompanion extends UpdateCompanion<ProfileSnapshot> {
  final Value<String> profileId;
  final Value<String> payload;
  final Value<DateTime> refreshedAt;
  final Value<int> rowid;
  const ProfileSnapshotsCompanion({
    this.profileId = const Value.absent(),
    this.payload = const Value.absent(),
    this.refreshedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  ProfileSnapshotsCompanion.insert({
    required String profileId,
    required String payload,
    required DateTime refreshedAt,
    this.rowid = const Value.absent(),
  }) : profileId = Value(profileId),
       payload = Value(payload),
       refreshedAt = Value(refreshedAt);
  static Insertable<ProfileSnapshot> custom({
    Expression<String>? profileId,
    Expression<String>? payload,
    Expression<DateTime>? refreshedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (profileId != null) 'profile_id': profileId,
      if (payload != null) 'payload': payload,
      if (refreshedAt != null) 'refreshed_at': refreshedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  ProfileSnapshotsCompanion copyWith({
    Value<String>? profileId,
    Value<String>? payload,
    Value<DateTime>? refreshedAt,
    Value<int>? rowid,
  }) {
    return ProfileSnapshotsCompanion(
      profileId: profileId ?? this.profileId,
      payload: payload ?? this.payload,
      refreshedAt: refreshedAt ?? this.refreshedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (profileId.present) {
      map['profile_id'] = Variable<String>(profileId.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (refreshedAt.present) {
      map['refreshed_at'] = Variable<DateTime>(refreshedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ProfileSnapshotsCompanion(')
          ..write('profileId: $profileId, ')
          ..write('payload: $payload, ')
          ..write('refreshedAt: $refreshedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $LocalSalesTable extends LocalSales
    with TableInfo<$LocalSalesTable, LocalSale> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $LocalSalesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _profileIdMeta = const VerificationMeta(
    'profileId',
  );
  @override
  late final GeneratedColumn<String> profileId = GeneratedColumn<String>(
    'profile_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _operatorIdMeta = const VerificationMeta(
    'operatorId',
  );
  @override
  late final GeneratedColumn<String> operatorId = GeneratedColumn<String>(
    'operator_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _totalMeta = const VerificationMeta('total');
  @override
  late final GeneratedColumn<int> total = GeneratedColumn<int>(
    'total',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _currencyMeta = const VerificationMeta(
    'currency',
  );
  @override
  late final GeneratedColumn<String> currency = GeneratedColumn<String>(
    'currency',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _requestMeta = const VerificationMeta(
    'request',
  );
  @override
  late final GeneratedColumn<String> request = GeneratedColumn<String>(
    'request',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _settlementMeta = const VerificationMeta(
    'settlement',
  );
  @override
  late final GeneratedColumn<String> settlement = GeneratedColumn<String>(
    'settlement',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _reversesSaleIdMeta = const VerificationMeta(
    'reversesSaleId',
  );
  @override
  late final GeneratedColumn<String> reversesSaleId = GeneratedColumn<String>(
    'reverses_sale_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES local_sales (id)',
    ),
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    profileId,
    operatorId,
    createdAt,
    total,
    currency,
    request,
    settlement,
    reversesSaleId,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'local_sales';
  @override
  VerificationContext validateIntegrity(
    Insertable<LocalSale> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('profile_id')) {
      context.handle(
        _profileIdMeta,
        profileId.isAcceptableOrUnknown(data['profile_id']!, _profileIdMeta),
      );
    } else if (isInserting) {
      context.missing(_profileIdMeta);
    }
    if (data.containsKey('operator_id')) {
      context.handle(
        _operatorIdMeta,
        operatorId.isAcceptableOrUnknown(data['operator_id']!, _operatorIdMeta),
      );
    } else if (isInserting) {
      context.missing(_operatorIdMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    if (data.containsKey('total')) {
      context.handle(
        _totalMeta,
        total.isAcceptableOrUnknown(data['total']!, _totalMeta),
      );
    } else if (isInserting) {
      context.missing(_totalMeta);
    }
    if (data.containsKey('currency')) {
      context.handle(
        _currencyMeta,
        currency.isAcceptableOrUnknown(data['currency']!, _currencyMeta),
      );
    } else if (isInserting) {
      context.missing(_currencyMeta);
    }
    if (data.containsKey('request')) {
      context.handle(
        _requestMeta,
        request.isAcceptableOrUnknown(data['request']!, _requestMeta),
      );
    } else if (isInserting) {
      context.missing(_requestMeta);
    }
    if (data.containsKey('settlement')) {
      context.handle(
        _settlementMeta,
        settlement.isAcceptableOrUnknown(data['settlement']!, _settlementMeta),
      );
    }
    if (data.containsKey('reverses_sale_id')) {
      context.handle(
        _reversesSaleIdMeta,
        reversesSaleId.isAcceptableOrUnknown(
          data['reverses_sale_id']!,
          _reversesSaleIdMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  LocalSale map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return LocalSale(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      profileId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}profile_id'],
      )!,
      operatorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}operator_id'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
      total: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}total'],
      )!,
      currency: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}currency'],
      )!,
      request: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}request'],
      )!,
      settlement: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}settlement'],
      ),
      reversesSaleId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}reverses_sale_id'],
      ),
    );
  }

  @override
  $LocalSalesTable createAlias(String alias) {
    return $LocalSalesTable(attachedDatabase, alias);
  }
}

class LocalSale extends DataClass implements Insertable<LocalSale> {
  final String id;
  final String profileId;
  final String operatorId;
  final DateTime createdAt;
  final int total;
  final String currency;
  final String request;
  final String? settlement;
  final String? reversesSaleId;
  const LocalSale({
    required this.id,
    required this.profileId,
    required this.operatorId,
    required this.createdAt,
    required this.total,
    required this.currency,
    required this.request,
    this.settlement,
    this.reversesSaleId,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['profile_id'] = Variable<String>(profileId);
    map['operator_id'] = Variable<String>(operatorId);
    map['created_at'] = Variable<DateTime>(createdAt);
    map['total'] = Variable<int>(total);
    map['currency'] = Variable<String>(currency);
    map['request'] = Variable<String>(request);
    if (!nullToAbsent || settlement != null) {
      map['settlement'] = Variable<String>(settlement);
    }
    if (!nullToAbsent || reversesSaleId != null) {
      map['reverses_sale_id'] = Variable<String>(reversesSaleId);
    }
    return map;
  }

  LocalSalesCompanion toCompanion(bool nullToAbsent) {
    return LocalSalesCompanion(
      id: Value(id),
      profileId: Value(profileId),
      operatorId: Value(operatorId),
      createdAt: Value(createdAt),
      total: Value(total),
      currency: Value(currency),
      request: Value(request),
      settlement: settlement == null && nullToAbsent
          ? const Value.absent()
          : Value(settlement),
      reversesSaleId: reversesSaleId == null && nullToAbsent
          ? const Value.absent()
          : Value(reversesSaleId),
    );
  }

  factory LocalSale.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return LocalSale(
      id: serializer.fromJson<String>(json['id']),
      profileId: serializer.fromJson<String>(json['profileId']),
      operatorId: serializer.fromJson<String>(json['operatorId']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
      total: serializer.fromJson<int>(json['total']),
      currency: serializer.fromJson<String>(json['currency']),
      request: serializer.fromJson<String>(json['request']),
      settlement: serializer.fromJson<String?>(json['settlement']),
      reversesSaleId: serializer.fromJson<String?>(json['reversesSaleId']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'profileId': serializer.toJson<String>(profileId),
      'operatorId': serializer.toJson<String>(operatorId),
      'createdAt': serializer.toJson<DateTime>(createdAt),
      'total': serializer.toJson<int>(total),
      'currency': serializer.toJson<String>(currency),
      'request': serializer.toJson<String>(request),
      'settlement': serializer.toJson<String?>(settlement),
      'reversesSaleId': serializer.toJson<String?>(reversesSaleId),
    };
  }

  LocalSale copyWith({
    String? id,
    String? profileId,
    String? operatorId,
    DateTime? createdAt,
    int? total,
    String? currency,
    String? request,
    Value<String?> settlement = const Value.absent(),
    Value<String?> reversesSaleId = const Value.absent(),
  }) => LocalSale(
    id: id ?? this.id,
    profileId: profileId ?? this.profileId,
    operatorId: operatorId ?? this.operatorId,
    createdAt: createdAt ?? this.createdAt,
    total: total ?? this.total,
    currency: currency ?? this.currency,
    request: request ?? this.request,
    settlement: settlement.present ? settlement.value : this.settlement,
    reversesSaleId: reversesSaleId.present
        ? reversesSaleId.value
        : this.reversesSaleId,
  );
  LocalSale copyWithCompanion(LocalSalesCompanion data) {
    return LocalSale(
      id: data.id.present ? data.id.value : this.id,
      profileId: data.profileId.present ? data.profileId.value : this.profileId,
      operatorId: data.operatorId.present
          ? data.operatorId.value
          : this.operatorId,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
      total: data.total.present ? data.total.value : this.total,
      currency: data.currency.present ? data.currency.value : this.currency,
      request: data.request.present ? data.request.value : this.request,
      settlement: data.settlement.present
          ? data.settlement.value
          : this.settlement,
      reversesSaleId: data.reversesSaleId.present
          ? data.reversesSaleId.value
          : this.reversesSaleId,
    );
  }

  @override
  String toString() {
    return (StringBuffer('LocalSale(')
          ..write('id: $id, ')
          ..write('profileId: $profileId, ')
          ..write('operatorId: $operatorId, ')
          ..write('createdAt: $createdAt, ')
          ..write('total: $total, ')
          ..write('currency: $currency, ')
          ..write('request: $request, ')
          ..write('settlement: $settlement, ')
          ..write('reversesSaleId: $reversesSaleId')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    profileId,
    operatorId,
    createdAt,
    total,
    currency,
    request,
    settlement,
    reversesSaleId,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is LocalSale &&
          other.id == this.id &&
          other.profileId == this.profileId &&
          other.operatorId == this.operatorId &&
          other.createdAt == this.createdAt &&
          other.total == this.total &&
          other.currency == this.currency &&
          other.request == this.request &&
          other.settlement == this.settlement &&
          other.reversesSaleId == this.reversesSaleId);
}

class LocalSalesCompanion extends UpdateCompanion<LocalSale> {
  final Value<String> id;
  final Value<String> profileId;
  final Value<String> operatorId;
  final Value<DateTime> createdAt;
  final Value<int> total;
  final Value<String> currency;
  final Value<String> request;
  final Value<String?> settlement;
  final Value<String?> reversesSaleId;
  final Value<int> rowid;
  const LocalSalesCompanion({
    this.id = const Value.absent(),
    this.profileId = const Value.absent(),
    this.operatorId = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.total = const Value.absent(),
    this.currency = const Value.absent(),
    this.request = const Value.absent(),
    this.settlement = const Value.absent(),
    this.reversesSaleId = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  LocalSalesCompanion.insert({
    required String id,
    required String profileId,
    required String operatorId,
    required DateTime createdAt,
    required int total,
    required String currency,
    required String request,
    this.settlement = const Value.absent(),
    this.reversesSaleId = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       profileId = Value(profileId),
       operatorId = Value(operatorId),
       createdAt = Value(createdAt),
       total = Value(total),
       currency = Value(currency),
       request = Value(request);
  static Insertable<LocalSale> custom({
    Expression<String>? id,
    Expression<String>? profileId,
    Expression<String>? operatorId,
    Expression<DateTime>? createdAt,
    Expression<int>? total,
    Expression<String>? currency,
    Expression<String>? request,
    Expression<String>? settlement,
    Expression<String>? reversesSaleId,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (profileId != null) 'profile_id': profileId,
      if (operatorId != null) 'operator_id': operatorId,
      if (createdAt != null) 'created_at': createdAt,
      if (total != null) 'total': total,
      if (currency != null) 'currency': currency,
      if (request != null) 'request': request,
      if (settlement != null) 'settlement': settlement,
      if (reversesSaleId != null) 'reverses_sale_id': reversesSaleId,
      if (rowid != null) 'rowid': rowid,
    });
  }

  LocalSalesCompanion copyWith({
    Value<String>? id,
    Value<String>? profileId,
    Value<String>? operatorId,
    Value<DateTime>? createdAt,
    Value<int>? total,
    Value<String>? currency,
    Value<String>? request,
    Value<String?>? settlement,
    Value<String?>? reversesSaleId,
    Value<int>? rowid,
  }) {
    return LocalSalesCompanion(
      id: id ?? this.id,
      profileId: profileId ?? this.profileId,
      operatorId: operatorId ?? this.operatorId,
      createdAt: createdAt ?? this.createdAt,
      total: total ?? this.total,
      currency: currency ?? this.currency,
      request: request ?? this.request,
      settlement: settlement ?? this.settlement,
      reversesSaleId: reversesSaleId ?? this.reversesSaleId,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (profileId.present) {
      map['profile_id'] = Variable<String>(profileId.value);
    }
    if (operatorId.present) {
      map['operator_id'] = Variable<String>(operatorId.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (total.present) {
      map['total'] = Variable<int>(total.value);
    }
    if (currency.present) {
      map['currency'] = Variable<String>(currency.value);
    }
    if (request.present) {
      map['request'] = Variable<String>(request.value);
    }
    if (settlement.present) {
      map['settlement'] = Variable<String>(settlement.value);
    }
    if (reversesSaleId.present) {
      map['reverses_sale_id'] = Variable<String>(reversesSaleId.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('LocalSalesCompanion(')
          ..write('id: $id, ')
          ..write('profileId: $profileId, ')
          ..write('operatorId: $operatorId, ')
          ..write('createdAt: $createdAt, ')
          ..write('total: $total, ')
          ..write('currency: $currency, ')
          ..write('request: $request, ')
          ..write('settlement: $settlement, ')
          ..write('reversesSaleId: $reversesSaleId, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $SaleOutboxTable extends SaleOutbox
    with TableInfo<$SaleOutboxTable, SaleOutboxData> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $SaleOutboxTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _sequenceMeta = const VerificationMeta(
    'sequence',
  );
  @override
  late final GeneratedColumn<int> sequence = GeneratedColumn<int>(
    'sequence',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _saleIdMeta = const VerificationMeta('saleId');
  @override
  late final GeneratedColumn<String> saleId = GeneratedColumn<String>(
    'sale_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'UNIQUE REFERENCES local_sales (id)',
    ),
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _attemptsMeta = const VerificationMeta(
    'attempts',
  );
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
    'attempts',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _retryAtMeta = const VerificationMeta(
    'retryAt',
  );
  @override
  late final GeneratedColumn<DateTime> retryAt = GeneratedColumn<DateTime>(
    'retry_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _serverDraftMeta = const VerificationMeta(
    'serverDraft',
  );
  @override
  late final GeneratedColumn<String> serverDraft = GeneratedColumn<String>(
    'server_draft',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _lastErrorMeta = const VerificationMeta(
    'lastError',
  );
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
    'last_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    sequence,
    saleId,
    status,
    attempts,
    retryAt,
    serverDraft,
    lastError,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'sale_outbox';
  @override
  VerificationContext validateIntegrity(
    Insertable<SaleOutboxData> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('sequence')) {
      context.handle(
        _sequenceMeta,
        sequence.isAcceptableOrUnknown(data['sequence']!, _sequenceMeta),
      );
    }
    if (data.containsKey('sale_id')) {
      context.handle(
        _saleIdMeta,
        saleId.isAcceptableOrUnknown(data['sale_id']!, _saleIdMeta),
      );
    } else if (isInserting) {
      context.missing(_saleIdMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('attempts')) {
      context.handle(
        _attemptsMeta,
        attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta),
      );
    }
    if (data.containsKey('retry_at')) {
      context.handle(
        _retryAtMeta,
        retryAt.isAcceptableOrUnknown(data['retry_at']!, _retryAtMeta),
      );
    } else if (isInserting) {
      context.missing(_retryAtMeta);
    }
    if (data.containsKey('server_draft')) {
      context.handle(
        _serverDraftMeta,
        serverDraft.isAcceptableOrUnknown(
          data['server_draft']!,
          _serverDraftMeta,
        ),
      );
    }
    if (data.containsKey('last_error')) {
      context.handle(
        _lastErrorMeta,
        lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {sequence};
  @override
  SaleOutboxData map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return SaleOutboxData(
      sequence: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}sequence'],
      )!,
      saleId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sale_id'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      attempts: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}attempts'],
      )!,
      retryAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}retry_at'],
      )!,
      serverDraft: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}server_draft'],
      ),
      lastError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error'],
      ),
    );
  }

  @override
  $SaleOutboxTable createAlias(String alias) {
    return $SaleOutboxTable(attachedDatabase, alias);
  }
}

class SaleOutboxData extends DataClass implements Insertable<SaleOutboxData> {
  final int sequence;
  final String saleId;
  final String status;
  final int attempts;
  final DateTime retryAt;
  final String? serverDraft;
  final String? lastError;
  const SaleOutboxData({
    required this.sequence,
    required this.saleId,
    required this.status,
    required this.attempts,
    required this.retryAt,
    this.serverDraft,
    this.lastError,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['sequence'] = Variable<int>(sequence);
    map['sale_id'] = Variable<String>(saleId);
    map['status'] = Variable<String>(status);
    map['attempts'] = Variable<int>(attempts);
    map['retry_at'] = Variable<DateTime>(retryAt);
    if (!nullToAbsent || serverDraft != null) {
      map['server_draft'] = Variable<String>(serverDraft);
    }
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    return map;
  }

  SaleOutboxCompanion toCompanion(bool nullToAbsent) {
    return SaleOutboxCompanion(
      sequence: Value(sequence),
      saleId: Value(saleId),
      status: Value(status),
      attempts: Value(attempts),
      retryAt: Value(retryAt),
      serverDraft: serverDraft == null && nullToAbsent
          ? const Value.absent()
          : Value(serverDraft),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
    );
  }

  factory SaleOutboxData.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return SaleOutboxData(
      sequence: serializer.fromJson<int>(json['sequence']),
      saleId: serializer.fromJson<String>(json['saleId']),
      status: serializer.fromJson<String>(json['status']),
      attempts: serializer.fromJson<int>(json['attempts']),
      retryAt: serializer.fromJson<DateTime>(json['retryAt']),
      serverDraft: serializer.fromJson<String?>(json['serverDraft']),
      lastError: serializer.fromJson<String?>(json['lastError']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'sequence': serializer.toJson<int>(sequence),
      'saleId': serializer.toJson<String>(saleId),
      'status': serializer.toJson<String>(status),
      'attempts': serializer.toJson<int>(attempts),
      'retryAt': serializer.toJson<DateTime>(retryAt),
      'serverDraft': serializer.toJson<String?>(serverDraft),
      'lastError': serializer.toJson<String?>(lastError),
    };
  }

  SaleOutboxData copyWith({
    int? sequence,
    String? saleId,
    String? status,
    int? attempts,
    DateTime? retryAt,
    Value<String?> serverDraft = const Value.absent(),
    Value<String?> lastError = const Value.absent(),
  }) => SaleOutboxData(
    sequence: sequence ?? this.sequence,
    saleId: saleId ?? this.saleId,
    status: status ?? this.status,
    attempts: attempts ?? this.attempts,
    retryAt: retryAt ?? this.retryAt,
    serverDraft: serverDraft.present ? serverDraft.value : this.serverDraft,
    lastError: lastError.present ? lastError.value : this.lastError,
  );
  SaleOutboxData copyWithCompanion(SaleOutboxCompanion data) {
    return SaleOutboxData(
      sequence: data.sequence.present ? data.sequence.value : this.sequence,
      saleId: data.saleId.present ? data.saleId.value : this.saleId,
      status: data.status.present ? data.status.value : this.status,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
      retryAt: data.retryAt.present ? data.retryAt.value : this.retryAt,
      serverDraft: data.serverDraft.present
          ? data.serverDraft.value
          : this.serverDraft,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
    );
  }

  @override
  String toString() {
    return (StringBuffer('SaleOutboxData(')
          ..write('sequence: $sequence, ')
          ..write('saleId: $saleId, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('retryAt: $retryAt, ')
          ..write('serverDraft: $serverDraft, ')
          ..write('lastError: $lastError')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    sequence,
    saleId,
    status,
    attempts,
    retryAt,
    serverDraft,
    lastError,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is SaleOutboxData &&
          other.sequence == this.sequence &&
          other.saleId == this.saleId &&
          other.status == this.status &&
          other.attempts == this.attempts &&
          other.retryAt == this.retryAt &&
          other.serverDraft == this.serverDraft &&
          other.lastError == this.lastError);
}

class SaleOutboxCompanion extends UpdateCompanion<SaleOutboxData> {
  final Value<int> sequence;
  final Value<String> saleId;
  final Value<String> status;
  final Value<int> attempts;
  final Value<DateTime> retryAt;
  final Value<String?> serverDraft;
  final Value<String?> lastError;
  const SaleOutboxCompanion({
    this.sequence = const Value.absent(),
    this.saleId = const Value.absent(),
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.retryAt = const Value.absent(),
    this.serverDraft = const Value.absent(),
    this.lastError = const Value.absent(),
  });
  SaleOutboxCompanion.insert({
    this.sequence = const Value.absent(),
    required String saleId,
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    required DateTime retryAt,
    this.serverDraft = const Value.absent(),
    this.lastError = const Value.absent(),
  }) : saleId = Value(saleId),
       retryAt = Value(retryAt);
  static Insertable<SaleOutboxData> custom({
    Expression<int>? sequence,
    Expression<String>? saleId,
    Expression<String>? status,
    Expression<int>? attempts,
    Expression<DateTime>? retryAt,
    Expression<String>? serverDraft,
    Expression<String>? lastError,
  }) {
    return RawValuesInsertable({
      if (sequence != null) 'sequence': sequence,
      if (saleId != null) 'sale_id': saleId,
      if (status != null) 'status': status,
      if (attempts != null) 'attempts': attempts,
      if (retryAt != null) 'retry_at': retryAt,
      if (serverDraft != null) 'server_draft': serverDraft,
      if (lastError != null) 'last_error': lastError,
    });
  }

  SaleOutboxCompanion copyWith({
    Value<int>? sequence,
    Value<String>? saleId,
    Value<String>? status,
    Value<int>? attempts,
    Value<DateTime>? retryAt,
    Value<String?>? serverDraft,
    Value<String?>? lastError,
  }) {
    return SaleOutboxCompanion(
      sequence: sequence ?? this.sequence,
      saleId: saleId ?? this.saleId,
      status: status ?? this.status,
      attempts: attempts ?? this.attempts,
      retryAt: retryAt ?? this.retryAt,
      serverDraft: serverDraft ?? this.serverDraft,
      lastError: lastError ?? this.lastError,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (sequence.present) {
      map['sequence'] = Variable<int>(sequence.value);
    }
    if (saleId.present) {
      map['sale_id'] = Variable<String>(saleId.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    if (retryAt.present) {
      map['retry_at'] = Variable<DateTime>(retryAt.value);
    }
    if (serverDraft.present) {
      map['server_draft'] = Variable<String>(serverDraft.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('SaleOutboxCompanion(')
          ..write('sequence: $sequence, ')
          ..write('saleId: $saleId, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('retryAt: $retryAt, ')
          ..write('serverDraft: $serverDraft, ')
          ..write('lastError: $lastError')
          ..write(')'))
        .toString();
  }
}

class $HeldBillsTable extends HeldBills
    with TableInfo<$HeldBillsTable, HeldBill> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $HeldBillsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _profileIdMeta = const VerificationMeta(
    'profileId',
  );
  @override
  late final GeneratedColumn<String> profileId = GeneratedColumn<String>(
    'profile_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _tableIdMeta = const VerificationMeta(
    'tableId',
  );
  @override
  late final GeneratedColumn<String> tableId = GeneratedColumn<String>(
    'table_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _workingDayIdMeta = const VerificationMeta(
    'workingDayId',
  );
  @override
  late final GeneratedColumn<String> workingDayId = GeneratedColumn<String>(
    'working_day_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _revisionMeta = const VerificationMeta(
    'revision',
  );
  @override
  late final GeneratedColumn<int> revision = GeneratedColumn<int>(
    'revision',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(1),
  );
  static const VerificationMeta _updatedAtMeta = const VerificationMeta(
    'updatedAt',
  );
  @override
  late final GeneratedColumn<DateTime> updatedAt = GeneratedColumn<DateTime>(
    'updated_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    profileId,
    tableId,
    workingDayId,
    payload,
    revision,
    updatedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'held_bills';
  @override
  VerificationContext validateIntegrity(
    Insertable<HeldBill> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('profile_id')) {
      context.handle(
        _profileIdMeta,
        profileId.isAcceptableOrUnknown(data['profile_id']!, _profileIdMeta),
      );
    } else if (isInserting) {
      context.missing(_profileIdMeta);
    }
    if (data.containsKey('table_id')) {
      context.handle(
        _tableIdMeta,
        tableId.isAcceptableOrUnknown(data['table_id']!, _tableIdMeta),
      );
    }
    if (data.containsKey('working_day_id')) {
      context.handle(
        _workingDayIdMeta,
        workingDayId.isAcceptableOrUnknown(
          data['working_day_id']!,
          _workingDayIdMeta,
        ),
      );
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    if (data.containsKey('revision')) {
      context.handle(
        _revisionMeta,
        revision.isAcceptableOrUnknown(data['revision']!, _revisionMeta),
      );
    }
    if (data.containsKey('updated_at')) {
      context.handle(
        _updatedAtMeta,
        updatedAt.isAcceptableOrUnknown(data['updated_at']!, _updatedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_updatedAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  List<Set<GeneratedColumn>> get uniqueKeys => [
    {profileId, tableId},
  ];
  @override
  HeldBill map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return HeldBill(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      profileId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}profile_id'],
      )!,
      tableId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}table_id'],
      ),
      workingDayId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}working_day_id'],
      ),
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
      revision: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}revision'],
      )!,
      updatedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}updated_at'],
      )!,
    );
  }

  @override
  $HeldBillsTable createAlias(String alias) {
    return $HeldBillsTable(attachedDatabase, alias);
  }
}

class HeldBill extends DataClass implements Insertable<HeldBill> {
  final String id;
  final String profileId;
  final String? tableId;
  final String? workingDayId;
  final String payload;
  final int revision;
  final DateTime updatedAt;
  const HeldBill({
    required this.id,
    required this.profileId,
    this.tableId,
    this.workingDayId,
    required this.payload,
    required this.revision,
    required this.updatedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['profile_id'] = Variable<String>(profileId);
    if (!nullToAbsent || tableId != null) {
      map['table_id'] = Variable<String>(tableId);
    }
    if (!nullToAbsent || workingDayId != null) {
      map['working_day_id'] = Variable<String>(workingDayId);
    }
    map['payload'] = Variable<String>(payload);
    map['revision'] = Variable<int>(revision);
    map['updated_at'] = Variable<DateTime>(updatedAt);
    return map;
  }

  HeldBillsCompanion toCompanion(bool nullToAbsent) {
    return HeldBillsCompanion(
      id: Value(id),
      profileId: Value(profileId),
      tableId: tableId == null && nullToAbsent
          ? const Value.absent()
          : Value(tableId),
      workingDayId: workingDayId == null && nullToAbsent
          ? const Value.absent()
          : Value(workingDayId),
      payload: Value(payload),
      revision: Value(revision),
      updatedAt: Value(updatedAt),
    );
  }

  factory HeldBill.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return HeldBill(
      id: serializer.fromJson<String>(json['id']),
      profileId: serializer.fromJson<String>(json['profileId']),
      tableId: serializer.fromJson<String?>(json['tableId']),
      workingDayId: serializer.fromJson<String?>(json['workingDayId']),
      payload: serializer.fromJson<String>(json['payload']),
      revision: serializer.fromJson<int>(json['revision']),
      updatedAt: serializer.fromJson<DateTime>(json['updatedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'profileId': serializer.toJson<String>(profileId),
      'tableId': serializer.toJson<String?>(tableId),
      'workingDayId': serializer.toJson<String?>(workingDayId),
      'payload': serializer.toJson<String>(payload),
      'revision': serializer.toJson<int>(revision),
      'updatedAt': serializer.toJson<DateTime>(updatedAt),
    };
  }

  HeldBill copyWith({
    String? id,
    String? profileId,
    Value<String?> tableId = const Value.absent(),
    Value<String?> workingDayId = const Value.absent(),
    String? payload,
    int? revision,
    DateTime? updatedAt,
  }) => HeldBill(
    id: id ?? this.id,
    profileId: profileId ?? this.profileId,
    tableId: tableId.present ? tableId.value : this.tableId,
    workingDayId: workingDayId.present ? workingDayId.value : this.workingDayId,
    payload: payload ?? this.payload,
    revision: revision ?? this.revision,
    updatedAt: updatedAt ?? this.updatedAt,
  );
  HeldBill copyWithCompanion(HeldBillsCompanion data) {
    return HeldBill(
      id: data.id.present ? data.id.value : this.id,
      profileId: data.profileId.present ? data.profileId.value : this.profileId,
      tableId: data.tableId.present ? data.tableId.value : this.tableId,
      workingDayId: data.workingDayId.present
          ? data.workingDayId.value
          : this.workingDayId,
      payload: data.payload.present ? data.payload.value : this.payload,
      revision: data.revision.present ? data.revision.value : this.revision,
      updatedAt: data.updatedAt.present ? data.updatedAt.value : this.updatedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('HeldBill(')
          ..write('id: $id, ')
          ..write('profileId: $profileId, ')
          ..write('tableId: $tableId, ')
          ..write('workingDayId: $workingDayId, ')
          ..write('payload: $payload, ')
          ..write('revision: $revision, ')
          ..write('updatedAt: $updatedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    id,
    profileId,
    tableId,
    workingDayId,
    payload,
    revision,
    updatedAt,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is HeldBill &&
          other.id == this.id &&
          other.profileId == this.profileId &&
          other.tableId == this.tableId &&
          other.workingDayId == this.workingDayId &&
          other.payload == this.payload &&
          other.revision == this.revision &&
          other.updatedAt == this.updatedAt);
}

class HeldBillsCompanion extends UpdateCompanion<HeldBill> {
  final Value<String> id;
  final Value<String> profileId;
  final Value<String?> tableId;
  final Value<String?> workingDayId;
  final Value<String> payload;
  final Value<int> revision;
  final Value<DateTime> updatedAt;
  final Value<int> rowid;
  const HeldBillsCompanion({
    this.id = const Value.absent(),
    this.profileId = const Value.absent(),
    this.tableId = const Value.absent(),
    this.workingDayId = const Value.absent(),
    this.payload = const Value.absent(),
    this.revision = const Value.absent(),
    this.updatedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  HeldBillsCompanion.insert({
    required String id,
    required String profileId,
    this.tableId = const Value.absent(),
    this.workingDayId = const Value.absent(),
    required String payload,
    this.revision = const Value.absent(),
    required DateTime updatedAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       profileId = Value(profileId),
       payload = Value(payload),
       updatedAt = Value(updatedAt);
  static Insertable<HeldBill> custom({
    Expression<String>? id,
    Expression<String>? profileId,
    Expression<String>? tableId,
    Expression<String>? workingDayId,
    Expression<String>? payload,
    Expression<int>? revision,
    Expression<DateTime>? updatedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (profileId != null) 'profile_id': profileId,
      if (tableId != null) 'table_id': tableId,
      if (workingDayId != null) 'working_day_id': workingDayId,
      if (payload != null) 'payload': payload,
      if (revision != null) 'revision': revision,
      if (updatedAt != null) 'updated_at': updatedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  HeldBillsCompanion copyWith({
    Value<String>? id,
    Value<String>? profileId,
    Value<String?>? tableId,
    Value<String?>? workingDayId,
    Value<String>? payload,
    Value<int>? revision,
    Value<DateTime>? updatedAt,
    Value<int>? rowid,
  }) {
    return HeldBillsCompanion(
      id: id ?? this.id,
      profileId: profileId ?? this.profileId,
      tableId: tableId ?? this.tableId,
      workingDayId: workingDayId ?? this.workingDayId,
      payload: payload ?? this.payload,
      revision: revision ?? this.revision,
      updatedAt: updatedAt ?? this.updatedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (profileId.present) {
      map['profile_id'] = Variable<String>(profileId.value);
    }
    if (tableId.present) {
      map['table_id'] = Variable<String>(tableId.value);
    }
    if (workingDayId.present) {
      map['working_day_id'] = Variable<String>(workingDayId.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (revision.present) {
      map['revision'] = Variable<int>(revision.value);
    }
    if (updatedAt.present) {
      map['updated_at'] = Variable<DateTime>(updatedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('HeldBillsCompanion(')
          ..write('id: $id, ')
          ..write('profileId: $profileId, ')
          ..write('tableId: $tableId, ')
          ..write('workingDayId: $workingDayId, ')
          ..write('payload: $payload, ')
          ..write('revision: $revision, ')
          ..write('updatedAt: $updatedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $RegisterCartDraftsTable extends RegisterCartDrafts
    with TableInfo<$RegisterCartDraftsTable, RegisterCartDraft> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RegisterCartDraftsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _operatorIdMeta = const VerificationMeta(
    'operatorId',
  );
  @override
  late final GeneratedColumn<String> operatorId = GeneratedColumn<String>(
    'operator_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES register_operators (id)',
    ),
  );
  static const VerificationMeta _profileIdMeta = const VerificationMeta(
    'profileId',
  );
  @override
  late final GeneratedColumn<String> profileId = GeneratedColumn<String>(
    'profile_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _billIdMeta = const VerificationMeta('billId');
  @override
  late final GeneratedColumn<String> billId = GeneratedColumn<String>(
    'bill_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    operatorId,
    profileId,
    billId,
    payload,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'register_cart_drafts';
  @override
  VerificationContext validateIntegrity(
    Insertable<RegisterCartDraft> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('operator_id')) {
      context.handle(
        _operatorIdMeta,
        operatorId.isAcceptableOrUnknown(data['operator_id']!, _operatorIdMeta),
      );
    } else if (isInserting) {
      context.missing(_operatorIdMeta);
    }
    if (data.containsKey('profile_id')) {
      context.handle(
        _profileIdMeta,
        profileId.isAcceptableOrUnknown(data['profile_id']!, _profileIdMeta),
      );
    } else if (isInserting) {
      context.missing(_profileIdMeta);
    }
    if (data.containsKey('bill_id')) {
      context.handle(
        _billIdMeta,
        billId.isAcceptableOrUnknown(data['bill_id']!, _billIdMeta),
      );
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {operatorId, profileId};
  @override
  RegisterCartDraft map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RegisterCartDraft(
      operatorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}operator_id'],
      )!,
      profileId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}profile_id'],
      )!,
      billId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}bill_id'],
      ),
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
    );
  }

  @override
  $RegisterCartDraftsTable createAlias(String alias) {
    return $RegisterCartDraftsTable(attachedDatabase, alias);
  }
}

class RegisterCartDraft extends DataClass
    implements Insertable<RegisterCartDraft> {
  final String operatorId;
  final String profileId;
  final String? billId;
  final String payload;
  const RegisterCartDraft({
    required this.operatorId,
    required this.profileId,
    this.billId,
    required this.payload,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['operator_id'] = Variable<String>(operatorId);
    map['profile_id'] = Variable<String>(profileId);
    if (!nullToAbsent || billId != null) {
      map['bill_id'] = Variable<String>(billId);
    }
    map['payload'] = Variable<String>(payload);
    return map;
  }

  RegisterCartDraftsCompanion toCompanion(bool nullToAbsent) {
    return RegisterCartDraftsCompanion(
      operatorId: Value(operatorId),
      profileId: Value(profileId),
      billId: billId == null && nullToAbsent
          ? const Value.absent()
          : Value(billId),
      payload: Value(payload),
    );
  }

  factory RegisterCartDraft.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RegisterCartDraft(
      operatorId: serializer.fromJson<String>(json['operatorId']),
      profileId: serializer.fromJson<String>(json['profileId']),
      billId: serializer.fromJson<String?>(json['billId']),
      payload: serializer.fromJson<String>(json['payload']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'operatorId': serializer.toJson<String>(operatorId),
      'profileId': serializer.toJson<String>(profileId),
      'billId': serializer.toJson<String?>(billId),
      'payload': serializer.toJson<String>(payload),
    };
  }

  RegisterCartDraft copyWith({
    String? operatorId,
    String? profileId,
    Value<String?> billId = const Value.absent(),
    String? payload,
  }) => RegisterCartDraft(
    operatorId: operatorId ?? this.operatorId,
    profileId: profileId ?? this.profileId,
    billId: billId.present ? billId.value : this.billId,
    payload: payload ?? this.payload,
  );
  RegisterCartDraft copyWithCompanion(RegisterCartDraftsCompanion data) {
    return RegisterCartDraft(
      operatorId: data.operatorId.present
          ? data.operatorId.value
          : this.operatorId,
      profileId: data.profileId.present ? data.profileId.value : this.profileId,
      billId: data.billId.present ? data.billId.value : this.billId,
      payload: data.payload.present ? data.payload.value : this.payload,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RegisterCartDraft(')
          ..write('operatorId: $operatorId, ')
          ..write('profileId: $profileId, ')
          ..write('billId: $billId, ')
          ..write('payload: $payload')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(operatorId, profileId, billId, payload);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RegisterCartDraft &&
          other.operatorId == this.operatorId &&
          other.profileId == this.profileId &&
          other.billId == this.billId &&
          other.payload == this.payload);
}

class RegisterCartDraftsCompanion extends UpdateCompanion<RegisterCartDraft> {
  final Value<String> operatorId;
  final Value<String> profileId;
  final Value<String?> billId;
  final Value<String> payload;
  final Value<int> rowid;
  const RegisterCartDraftsCompanion({
    this.operatorId = const Value.absent(),
    this.profileId = const Value.absent(),
    this.billId = const Value.absent(),
    this.payload = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  RegisterCartDraftsCompanion.insert({
    required String operatorId,
    required String profileId,
    this.billId = const Value.absent(),
    required String payload,
    this.rowid = const Value.absent(),
  }) : operatorId = Value(operatorId),
       profileId = Value(profileId),
       payload = Value(payload);
  static Insertable<RegisterCartDraft> custom({
    Expression<String>? operatorId,
    Expression<String>? profileId,
    Expression<String>? billId,
    Expression<String>? payload,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (operatorId != null) 'operator_id': operatorId,
      if (profileId != null) 'profile_id': profileId,
      if (billId != null) 'bill_id': billId,
      if (payload != null) 'payload': payload,
      if (rowid != null) 'rowid': rowid,
    });
  }

  RegisterCartDraftsCompanion copyWith({
    Value<String>? operatorId,
    Value<String>? profileId,
    Value<String?>? billId,
    Value<String>? payload,
    Value<int>? rowid,
  }) {
    return RegisterCartDraftsCompanion(
      operatorId: operatorId ?? this.operatorId,
      profileId: profileId ?? this.profileId,
      billId: billId ?? this.billId,
      payload: payload ?? this.payload,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (operatorId.present) {
      map['operator_id'] = Variable<String>(operatorId.value);
    }
    if (profileId.present) {
      map['profile_id'] = Variable<String>(profileId.value);
    }
    if (billId.present) {
      map['bill_id'] = Variable<String>(billId.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RegisterCartDraftsCompanion(')
          ..write('operatorId: $operatorId, ')
          ..write('profileId: $profileId, ')
          ..write('billId: $billId, ')
          ..write('payload: $payload, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $RegisterCommandsTable extends RegisterCommands
    with TableInfo<$RegisterCommandsTable, RegisterCommand> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $RegisterCommandsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _operatorIdMeta = const VerificationMeta(
    'operatorId',
  );
  @override
  late final GeneratedColumn<String> operatorId = GeneratedColumn<String>(
    'operator_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _profileIdMeta = const VerificationMeta(
    'profileId',
  );
  @override
  late final GeneratedColumn<String> profileId = GeneratedColumn<String>(
    'profile_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _fingerprintMeta = const VerificationMeta(
    'fingerprint',
  );
  @override
  late final GeneratedColumn<String> fingerprint = GeneratedColumn<String>(
    'fingerprint',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _resultMeta = const VerificationMeta('result');
  @override
  late final GeneratedColumn<String> result = GeneratedColumn<String>(
    'result',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _createdAtMeta = const VerificationMeta(
    'createdAt',
  );
  @override
  late final GeneratedColumn<DateTime> createdAt = GeneratedColumn<DateTime>(
    'created_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    operatorId,
    profileId,
    fingerprint,
    result,
    createdAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'register_commands';
  @override
  VerificationContext validateIntegrity(
    Insertable<RegisterCommand> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('operator_id')) {
      context.handle(
        _operatorIdMeta,
        operatorId.isAcceptableOrUnknown(data['operator_id']!, _operatorIdMeta),
      );
    } else if (isInserting) {
      context.missing(_operatorIdMeta);
    }
    if (data.containsKey('profile_id')) {
      context.handle(
        _profileIdMeta,
        profileId.isAcceptableOrUnknown(data['profile_id']!, _profileIdMeta),
      );
    }
    if (data.containsKey('fingerprint')) {
      context.handle(
        _fingerprintMeta,
        fingerprint.isAcceptableOrUnknown(
          data['fingerprint']!,
          _fingerprintMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_fingerprintMeta);
    }
    if (data.containsKey('result')) {
      context.handle(
        _resultMeta,
        result.isAcceptableOrUnknown(data['result']!, _resultMeta),
      );
    } else if (isInserting) {
      context.missing(_resultMeta);
    }
    if (data.containsKey('created_at')) {
      context.handle(
        _createdAtMeta,
        createdAt.isAcceptableOrUnknown(data['created_at']!, _createdAtMeta),
      );
    } else if (isInserting) {
      context.missing(_createdAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  RegisterCommand map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return RegisterCommand(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      operatorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}operator_id'],
      )!,
      profileId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}profile_id'],
      ),
      fingerprint: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}fingerprint'],
      )!,
      result: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}result'],
      )!,
      createdAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}created_at'],
      )!,
    );
  }

  @override
  $RegisterCommandsTable createAlias(String alias) {
    return $RegisterCommandsTable(attachedDatabase, alias);
  }
}

class RegisterCommand extends DataClass implements Insertable<RegisterCommand> {
  final String id;
  final String operatorId;
  final String? profileId;
  final String fingerprint;
  final String result;
  final DateTime createdAt;
  const RegisterCommand({
    required this.id,
    required this.operatorId,
    this.profileId,
    required this.fingerprint,
    required this.result,
    required this.createdAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    map['operator_id'] = Variable<String>(operatorId);
    if (!nullToAbsent || profileId != null) {
      map['profile_id'] = Variable<String>(profileId);
    }
    map['fingerprint'] = Variable<String>(fingerprint);
    map['result'] = Variable<String>(result);
    map['created_at'] = Variable<DateTime>(createdAt);
    return map;
  }

  RegisterCommandsCompanion toCompanion(bool nullToAbsent) {
    return RegisterCommandsCompanion(
      id: Value(id),
      operatorId: Value(operatorId),
      profileId: profileId == null && nullToAbsent
          ? const Value.absent()
          : Value(profileId),
      fingerprint: Value(fingerprint),
      result: Value(result),
      createdAt: Value(createdAt),
    );
  }

  factory RegisterCommand.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return RegisterCommand(
      id: serializer.fromJson<String>(json['id']),
      operatorId: serializer.fromJson<String>(json['operatorId']),
      profileId: serializer.fromJson<String?>(json['profileId']),
      fingerprint: serializer.fromJson<String>(json['fingerprint']),
      result: serializer.fromJson<String>(json['result']),
      createdAt: serializer.fromJson<DateTime>(json['createdAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'operatorId': serializer.toJson<String>(operatorId),
      'profileId': serializer.toJson<String?>(profileId),
      'fingerprint': serializer.toJson<String>(fingerprint),
      'result': serializer.toJson<String>(result),
      'createdAt': serializer.toJson<DateTime>(createdAt),
    };
  }

  RegisterCommand copyWith({
    String? id,
    String? operatorId,
    Value<String?> profileId = const Value.absent(),
    String? fingerprint,
    String? result,
    DateTime? createdAt,
  }) => RegisterCommand(
    id: id ?? this.id,
    operatorId: operatorId ?? this.operatorId,
    profileId: profileId.present ? profileId.value : this.profileId,
    fingerprint: fingerprint ?? this.fingerprint,
    result: result ?? this.result,
    createdAt: createdAt ?? this.createdAt,
  );
  RegisterCommand copyWithCompanion(RegisterCommandsCompanion data) {
    return RegisterCommand(
      id: data.id.present ? data.id.value : this.id,
      operatorId: data.operatorId.present
          ? data.operatorId.value
          : this.operatorId,
      profileId: data.profileId.present ? data.profileId.value : this.profileId,
      fingerprint: data.fingerprint.present
          ? data.fingerprint.value
          : this.fingerprint,
      result: data.result.present ? data.result.value : this.result,
      createdAt: data.createdAt.present ? data.createdAt.value : this.createdAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('RegisterCommand(')
          ..write('id: $id, ')
          ..write('operatorId: $operatorId, ')
          ..write('profileId: $profileId, ')
          ..write('fingerprint: $fingerprint, ')
          ..write('result: $result, ')
          ..write('createdAt: $createdAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, operatorId, profileId, fingerprint, result, createdAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is RegisterCommand &&
          other.id == this.id &&
          other.operatorId == this.operatorId &&
          other.profileId == this.profileId &&
          other.fingerprint == this.fingerprint &&
          other.result == this.result &&
          other.createdAt == this.createdAt);
}

class RegisterCommandsCompanion extends UpdateCompanion<RegisterCommand> {
  final Value<String> id;
  final Value<String> operatorId;
  final Value<String?> profileId;
  final Value<String> fingerprint;
  final Value<String> result;
  final Value<DateTime> createdAt;
  final Value<int> rowid;
  const RegisterCommandsCompanion({
    this.id = const Value.absent(),
    this.operatorId = const Value.absent(),
    this.profileId = const Value.absent(),
    this.fingerprint = const Value.absent(),
    this.result = const Value.absent(),
    this.createdAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  RegisterCommandsCompanion.insert({
    required String id,
    required String operatorId,
    this.profileId = const Value.absent(),
    required String fingerprint,
    required String result,
    required DateTime createdAt,
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       operatorId = Value(operatorId),
       fingerprint = Value(fingerprint),
       result = Value(result),
       createdAt = Value(createdAt);
  static Insertable<RegisterCommand> custom({
    Expression<String>? id,
    Expression<String>? operatorId,
    Expression<String>? profileId,
    Expression<String>? fingerprint,
    Expression<String>? result,
    Expression<DateTime>? createdAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (operatorId != null) 'operator_id': operatorId,
      if (profileId != null) 'profile_id': profileId,
      if (fingerprint != null) 'fingerprint': fingerprint,
      if (result != null) 'result': result,
      if (createdAt != null) 'created_at': createdAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  RegisterCommandsCompanion copyWith({
    Value<String>? id,
    Value<String>? operatorId,
    Value<String?>? profileId,
    Value<String>? fingerprint,
    Value<String>? result,
    Value<DateTime>? createdAt,
    Value<int>? rowid,
  }) {
    return RegisterCommandsCompanion(
      id: id ?? this.id,
      operatorId: operatorId ?? this.operatorId,
      profileId: profileId ?? this.profileId,
      fingerprint: fingerprint ?? this.fingerprint,
      result: result ?? this.result,
      createdAt: createdAt ?? this.createdAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (operatorId.present) {
      map['operator_id'] = Variable<String>(operatorId.value);
    }
    if (profileId.present) {
      map['profile_id'] = Variable<String>(profileId.value);
    }
    if (fingerprint.present) {
      map['fingerprint'] = Variable<String>(fingerprint.value);
    }
    if (result.present) {
      map['result'] = Variable<String>(result.value);
    }
    if (createdAt.present) {
      map['created_at'] = Variable<DateTime>(createdAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('RegisterCommandsCompanion(')
          ..write('id: $id, ')
          ..write('operatorId: $operatorId, ')
          ..write('profileId: $profileId, ')
          ..write('fingerprint: $fingerprint, ')
          ..write('result: $result, ')
          ..write('createdAt: $createdAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $StoreNetworkSettingsTable extends StoreNetworkSettings
    with TableInfo<$StoreNetworkSettingsTable, StoreNetworkSetting> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $StoreNetworkSettingsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(1),
  );
  static const VerificationMeta _modeMeta = const VerificationMeta('mode');
  @override
  late final GeneratedColumn<String> mode = GeneratedColumn<String>(
    'mode',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _endpointMeta = const VerificationMeta(
    'endpoint',
  );
  @override
  late final GeneratedColumn<String> endpoint = GeneratedColumn<String>(
    'endpoint',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _fingerprintMeta = const VerificationMeta(
    'fingerprint',
  );
  @override
  late final GeneratedColumn<String> fingerprint = GeneratedColumn<String>(
    'fingerprint',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [id, mode, endpoint, fingerprint];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'store_network_settings';
  @override
  VerificationContext validateIntegrity(
    Insertable<StoreNetworkSetting> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('mode')) {
      context.handle(
        _modeMeta,
        mode.isAcceptableOrUnknown(data['mode']!, _modeMeta),
      );
    } else if (isInserting) {
      context.missing(_modeMeta);
    }
    if (data.containsKey('endpoint')) {
      context.handle(
        _endpointMeta,
        endpoint.isAcceptableOrUnknown(data['endpoint']!, _endpointMeta),
      );
    }
    if (data.containsKey('fingerprint')) {
      context.handle(
        _fingerprintMeta,
        fingerprint.isAcceptableOrUnknown(
          data['fingerprint']!,
          _fingerprintMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  StoreNetworkSetting map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return StoreNetworkSetting(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      mode: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}mode'],
      )!,
      endpoint: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}endpoint'],
      ),
      fingerprint: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}fingerprint'],
      ),
    );
  }

  @override
  $StoreNetworkSettingsTable createAlias(String alias) {
    return $StoreNetworkSettingsTable(attachedDatabase, alias);
  }
}

class StoreNetworkSetting extends DataClass
    implements Insertable<StoreNetworkSetting> {
  final int id;
  final String mode;
  final String? endpoint;
  final String? fingerprint;
  const StoreNetworkSetting({
    required this.id,
    required this.mode,
    this.endpoint,
    this.fingerprint,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['mode'] = Variable<String>(mode);
    if (!nullToAbsent || endpoint != null) {
      map['endpoint'] = Variable<String>(endpoint);
    }
    if (!nullToAbsent || fingerprint != null) {
      map['fingerprint'] = Variable<String>(fingerprint);
    }
    return map;
  }

  StoreNetworkSettingsCompanion toCompanion(bool nullToAbsent) {
    return StoreNetworkSettingsCompanion(
      id: Value(id),
      mode: Value(mode),
      endpoint: endpoint == null && nullToAbsent
          ? const Value.absent()
          : Value(endpoint),
      fingerprint: fingerprint == null && nullToAbsent
          ? const Value.absent()
          : Value(fingerprint),
    );
  }

  factory StoreNetworkSetting.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return StoreNetworkSetting(
      id: serializer.fromJson<int>(json['id']),
      mode: serializer.fromJson<String>(json['mode']),
      endpoint: serializer.fromJson<String?>(json['endpoint']),
      fingerprint: serializer.fromJson<String?>(json['fingerprint']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'mode': serializer.toJson<String>(mode),
      'endpoint': serializer.toJson<String?>(endpoint),
      'fingerprint': serializer.toJson<String?>(fingerprint),
    };
  }

  StoreNetworkSetting copyWith({
    int? id,
    String? mode,
    Value<String?> endpoint = const Value.absent(),
    Value<String?> fingerprint = const Value.absent(),
  }) => StoreNetworkSetting(
    id: id ?? this.id,
    mode: mode ?? this.mode,
    endpoint: endpoint.present ? endpoint.value : this.endpoint,
    fingerprint: fingerprint.present ? fingerprint.value : this.fingerprint,
  );
  StoreNetworkSetting copyWithCompanion(StoreNetworkSettingsCompanion data) {
    return StoreNetworkSetting(
      id: data.id.present ? data.id.value : this.id,
      mode: data.mode.present ? data.mode.value : this.mode,
      endpoint: data.endpoint.present ? data.endpoint.value : this.endpoint,
      fingerprint: data.fingerprint.present
          ? data.fingerprint.value
          : this.fingerprint,
    );
  }

  @override
  String toString() {
    return (StringBuffer('StoreNetworkSetting(')
          ..write('id: $id, ')
          ..write('mode: $mode, ')
          ..write('endpoint: $endpoint, ')
          ..write('fingerprint: $fingerprint')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, mode, endpoint, fingerprint);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StoreNetworkSetting &&
          other.id == this.id &&
          other.mode == this.mode &&
          other.endpoint == this.endpoint &&
          other.fingerprint == this.fingerprint);
}

class StoreNetworkSettingsCompanion
    extends UpdateCompanion<StoreNetworkSetting> {
  final Value<int> id;
  final Value<String> mode;
  final Value<String?> endpoint;
  final Value<String?> fingerprint;
  const StoreNetworkSettingsCompanion({
    this.id = const Value.absent(),
    this.mode = const Value.absent(),
    this.endpoint = const Value.absent(),
    this.fingerprint = const Value.absent(),
  });
  StoreNetworkSettingsCompanion.insert({
    this.id = const Value.absent(),
    required String mode,
    this.endpoint = const Value.absent(),
    this.fingerprint = const Value.absent(),
  }) : mode = Value(mode);
  static Insertable<StoreNetworkSetting> custom({
    Expression<int>? id,
    Expression<String>? mode,
    Expression<String>? endpoint,
    Expression<String>? fingerprint,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (mode != null) 'mode': mode,
      if (endpoint != null) 'endpoint': endpoint,
      if (fingerprint != null) 'fingerprint': fingerprint,
    });
  }

  StoreNetworkSettingsCompanion copyWith({
    Value<int>? id,
    Value<String>? mode,
    Value<String?>? endpoint,
    Value<String?>? fingerprint,
  }) {
    return StoreNetworkSettingsCompanion(
      id: id ?? this.id,
      mode: mode ?? this.mode,
      endpoint: endpoint ?? this.endpoint,
      fingerprint: fingerprint ?? this.fingerprint,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (mode.present) {
      map['mode'] = Variable<String>(mode.value);
    }
    if (endpoint.present) {
      map['endpoint'] = Variable<String>(endpoint.value);
    }
    if (fingerprint.present) {
      map['fingerprint'] = Variable<String>(fingerprint.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('StoreNetworkSettingsCompanion(')
          ..write('id: $id, ')
          ..write('mode: $mode, ')
          ..write('endpoint: $endpoint, ')
          ..write('fingerprint: $fingerprint')
          ..write(')'))
        .toString();
  }
}

class $StoreDevicesTable extends StoreDevices
    with TableInfo<$StoreDevicesTable, StoreDevice> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $StoreDevicesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<String> id = GeneratedColumn<String>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _profileIdMeta = const VerificationMeta(
    'profileId',
  );
  @override
  late final GeneratedColumn<String> profileId = GeneratedColumn<String>(
    'profile_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _nameMeta = const VerificationMeta('name');
  @override
  late final GeneratedColumn<String> name = GeneratedColumn<String>(
    'name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _credentialHashMeta = const VerificationMeta(
    'credentialHash',
  );
  @override
  late final GeneratedColumn<String> credentialHash = GeneratedColumn<String>(
    'credential_hash',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _pairedAtMeta = const VerificationMeta(
    'pairedAt',
  );
  @override
  late final GeneratedColumn<DateTime> pairedAt = GeneratedColumn<DateTime>(
    'paired_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _revokedAtMeta = const VerificationMeta(
    'revokedAt',
  );
  @override
  late final GeneratedColumn<DateTime> revokedAt = GeneratedColumn<DateTime>(
    'revoked_at',
    aliasedName,
    true,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    profileId,
    name,
    credentialHash,
    pairedAt,
    revokedAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'store_devices';
  @override
  VerificationContext validateIntegrity(
    Insertable<StoreDevice> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    } else if (isInserting) {
      context.missing(_idMeta);
    }
    if (data.containsKey('profile_id')) {
      context.handle(
        _profileIdMeta,
        profileId.isAcceptableOrUnknown(data['profile_id']!, _profileIdMeta),
      );
    }
    if (data.containsKey('name')) {
      context.handle(
        _nameMeta,
        name.isAcceptableOrUnknown(data['name']!, _nameMeta),
      );
    } else if (isInserting) {
      context.missing(_nameMeta);
    }
    if (data.containsKey('credential_hash')) {
      context.handle(
        _credentialHashMeta,
        credentialHash.isAcceptableOrUnknown(
          data['credential_hash']!,
          _credentialHashMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_credentialHashMeta);
    }
    if (data.containsKey('paired_at')) {
      context.handle(
        _pairedAtMeta,
        pairedAt.isAcceptableOrUnknown(data['paired_at']!, _pairedAtMeta),
      );
    } else if (isInserting) {
      context.missing(_pairedAtMeta);
    }
    if (data.containsKey('revoked_at')) {
      context.handle(
        _revokedAtMeta,
        revokedAt.isAcceptableOrUnknown(data['revoked_at']!, _revokedAtMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  StoreDevice map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return StoreDevice(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}id'],
      )!,
      profileId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}profile_id'],
      ),
      name: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}name'],
      )!,
      credentialHash: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}credential_hash'],
      )!,
      pairedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}paired_at'],
      )!,
      revokedAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}revoked_at'],
      ),
    );
  }

  @override
  $StoreDevicesTable createAlias(String alias) {
    return $StoreDevicesTable(attachedDatabase, alias);
  }
}

class StoreDevice extends DataClass implements Insertable<StoreDevice> {
  final String id;
  final String? profileId;
  final String name;
  final String credentialHash;
  final DateTime pairedAt;
  final DateTime? revokedAt;
  const StoreDevice({
    required this.id,
    this.profileId,
    required this.name,
    required this.credentialHash,
    required this.pairedAt,
    this.revokedAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<String>(id);
    if (!nullToAbsent || profileId != null) {
      map['profile_id'] = Variable<String>(profileId);
    }
    map['name'] = Variable<String>(name);
    map['credential_hash'] = Variable<String>(credentialHash);
    map['paired_at'] = Variable<DateTime>(pairedAt);
    if (!nullToAbsent || revokedAt != null) {
      map['revoked_at'] = Variable<DateTime>(revokedAt);
    }
    return map;
  }

  StoreDevicesCompanion toCompanion(bool nullToAbsent) {
    return StoreDevicesCompanion(
      id: Value(id),
      profileId: profileId == null && nullToAbsent
          ? const Value.absent()
          : Value(profileId),
      name: Value(name),
      credentialHash: Value(credentialHash),
      pairedAt: Value(pairedAt),
      revokedAt: revokedAt == null && nullToAbsent
          ? const Value.absent()
          : Value(revokedAt),
    );
  }

  factory StoreDevice.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return StoreDevice(
      id: serializer.fromJson<String>(json['id']),
      profileId: serializer.fromJson<String?>(json['profileId']),
      name: serializer.fromJson<String>(json['name']),
      credentialHash: serializer.fromJson<String>(json['credentialHash']),
      pairedAt: serializer.fromJson<DateTime>(json['pairedAt']),
      revokedAt: serializer.fromJson<DateTime?>(json['revokedAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<String>(id),
      'profileId': serializer.toJson<String?>(profileId),
      'name': serializer.toJson<String>(name),
      'credentialHash': serializer.toJson<String>(credentialHash),
      'pairedAt': serializer.toJson<DateTime>(pairedAt),
      'revokedAt': serializer.toJson<DateTime?>(revokedAt),
    };
  }

  StoreDevice copyWith({
    String? id,
    Value<String?> profileId = const Value.absent(),
    String? name,
    String? credentialHash,
    DateTime? pairedAt,
    Value<DateTime?> revokedAt = const Value.absent(),
  }) => StoreDevice(
    id: id ?? this.id,
    profileId: profileId.present ? profileId.value : this.profileId,
    name: name ?? this.name,
    credentialHash: credentialHash ?? this.credentialHash,
    pairedAt: pairedAt ?? this.pairedAt,
    revokedAt: revokedAt.present ? revokedAt.value : this.revokedAt,
  );
  StoreDevice copyWithCompanion(StoreDevicesCompanion data) {
    return StoreDevice(
      id: data.id.present ? data.id.value : this.id,
      profileId: data.profileId.present ? data.profileId.value : this.profileId,
      name: data.name.present ? data.name.value : this.name,
      credentialHash: data.credentialHash.present
          ? data.credentialHash.value
          : this.credentialHash,
      pairedAt: data.pairedAt.present ? data.pairedAt.value : this.pairedAt,
      revokedAt: data.revokedAt.present ? data.revokedAt.value : this.revokedAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('StoreDevice(')
          ..write('id: $id, ')
          ..write('profileId: $profileId, ')
          ..write('name: $name, ')
          ..write('credentialHash: $credentialHash, ')
          ..write('pairedAt: $pairedAt, ')
          ..write('revokedAt: $revokedAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, profileId, name, credentialHash, pairedAt, revokedAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StoreDevice &&
          other.id == this.id &&
          other.profileId == this.profileId &&
          other.name == this.name &&
          other.credentialHash == this.credentialHash &&
          other.pairedAt == this.pairedAt &&
          other.revokedAt == this.revokedAt);
}

class StoreDevicesCompanion extends UpdateCompanion<StoreDevice> {
  final Value<String> id;
  final Value<String?> profileId;
  final Value<String> name;
  final Value<String> credentialHash;
  final Value<DateTime> pairedAt;
  final Value<DateTime?> revokedAt;
  final Value<int> rowid;
  const StoreDevicesCompanion({
    this.id = const Value.absent(),
    this.profileId = const Value.absent(),
    this.name = const Value.absent(),
    this.credentialHash = const Value.absent(),
    this.pairedAt = const Value.absent(),
    this.revokedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  StoreDevicesCompanion.insert({
    required String id,
    this.profileId = const Value.absent(),
    required String name,
    required String credentialHash,
    required DateTime pairedAt,
    this.revokedAt = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : id = Value(id),
       name = Value(name),
       credentialHash = Value(credentialHash),
       pairedAt = Value(pairedAt);
  static Insertable<StoreDevice> custom({
    Expression<String>? id,
    Expression<String>? profileId,
    Expression<String>? name,
    Expression<String>? credentialHash,
    Expression<DateTime>? pairedAt,
    Expression<DateTime>? revokedAt,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (profileId != null) 'profile_id': profileId,
      if (name != null) 'name': name,
      if (credentialHash != null) 'credential_hash': credentialHash,
      if (pairedAt != null) 'paired_at': pairedAt,
      if (revokedAt != null) 'revoked_at': revokedAt,
      if (rowid != null) 'rowid': rowid,
    });
  }

  StoreDevicesCompanion copyWith({
    Value<String>? id,
    Value<String?>? profileId,
    Value<String>? name,
    Value<String>? credentialHash,
    Value<DateTime>? pairedAt,
    Value<DateTime?>? revokedAt,
    Value<int>? rowid,
  }) {
    return StoreDevicesCompanion(
      id: id ?? this.id,
      profileId: profileId ?? this.profileId,
      name: name ?? this.name,
      credentialHash: credentialHash ?? this.credentialHash,
      pairedAt: pairedAt ?? this.pairedAt,
      revokedAt: revokedAt ?? this.revokedAt,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<String>(id.value);
    }
    if (profileId.present) {
      map['profile_id'] = Variable<String>(profileId.value);
    }
    if (name.present) {
      map['name'] = Variable<String>(name.value);
    }
    if (credentialHash.present) {
      map['credential_hash'] = Variable<String>(credentialHash.value);
    }
    if (pairedAt.present) {
      map['paired_at'] = Variable<DateTime>(pairedAt.value);
    }
    if (revokedAt.present) {
      map['revoked_at'] = Variable<DateTime>(revokedAt.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('StoreDevicesCompanion(')
          ..write('id: $id, ')
          ..write('profileId: $profileId, ')
          ..write('name: $name, ')
          ..write('credentialHash: $credentialHash, ')
          ..write('pairedAt: $pairedAt, ')
          ..write('revokedAt: $revokedAt, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $StoreStaffGrantsTable extends StoreStaffGrants
    with TableInfo<$StoreStaffGrantsTable, StoreStaffGrant> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $StoreStaffGrantsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _deviceIdMeta = const VerificationMeta(
    'deviceId',
  );
  @override
  late final GeneratedColumn<String> deviceId = GeneratedColumn<String>(
    'device_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'REFERENCES store_devices (id)',
    ),
  );
  static const VerificationMeta _operatorIdMeta = const VerificationMeta(
    'operatorId',
  );
  @override
  late final GeneratedColumn<String> operatorId = GeneratedColumn<String>(
    'operator_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _displayNameMeta = const VerificationMeta(
    'displayName',
  );
  @override
  late final GeneratedColumn<String> displayName = GeneratedColumn<String>(
    'display_name',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _roleMeta = const VerificationMeta('role');
  @override
  late final GeneratedColumn<String> role = GeneratedColumn<String>(
    'role',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _credentialHashMeta = const VerificationMeta(
    'credentialHash',
  );
  @override
  late final GeneratedColumn<String> credentialHash = GeneratedColumn<String>(
    'credential_hash',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  @override
  List<GeneratedColumn> get $columns => [
    deviceId,
    operatorId,
    displayName,
    role,
    credentialHash,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'store_staff_grants';
  @override
  VerificationContext validateIntegrity(
    Insertable<StoreStaffGrant> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('device_id')) {
      context.handle(
        _deviceIdMeta,
        deviceId.isAcceptableOrUnknown(data['device_id']!, _deviceIdMeta),
      );
    } else if (isInserting) {
      context.missing(_deviceIdMeta);
    }
    if (data.containsKey('operator_id')) {
      context.handle(
        _operatorIdMeta,
        operatorId.isAcceptableOrUnknown(data['operator_id']!, _operatorIdMeta),
      );
    } else if (isInserting) {
      context.missing(_operatorIdMeta);
    }
    if (data.containsKey('display_name')) {
      context.handle(
        _displayNameMeta,
        displayName.isAcceptableOrUnknown(
          data['display_name']!,
          _displayNameMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_displayNameMeta);
    }
    if (data.containsKey('role')) {
      context.handle(
        _roleMeta,
        role.isAcceptableOrUnknown(data['role']!, _roleMeta),
      );
    } else if (isInserting) {
      context.missing(_roleMeta);
    }
    if (data.containsKey('credential_hash')) {
      context.handle(
        _credentialHashMeta,
        credentialHash.isAcceptableOrUnknown(
          data['credential_hash']!,
          _credentialHashMeta,
        ),
      );
    } else if (isInserting) {
      context.missing(_credentialHashMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {deviceId, operatorId};
  @override
  StoreStaffGrant map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return StoreStaffGrant(
      deviceId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}device_id'],
      )!,
      operatorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}operator_id'],
      )!,
      displayName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}display_name'],
      )!,
      role: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}role'],
      )!,
      credentialHash: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}credential_hash'],
      )!,
    );
  }

  @override
  $StoreStaffGrantsTable createAlias(String alias) {
    return $StoreStaffGrantsTable(attachedDatabase, alias);
  }
}

class StoreStaffGrant extends DataClass implements Insertable<StoreStaffGrant> {
  final String deviceId;
  final String operatorId;
  final String displayName;
  final String role;
  final String credentialHash;
  const StoreStaffGrant({
    required this.deviceId,
    required this.operatorId,
    required this.displayName,
    required this.role,
    required this.credentialHash,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['device_id'] = Variable<String>(deviceId);
    map['operator_id'] = Variable<String>(operatorId);
    map['display_name'] = Variable<String>(displayName);
    map['role'] = Variable<String>(role);
    map['credential_hash'] = Variable<String>(credentialHash);
    return map;
  }

  StoreStaffGrantsCompanion toCompanion(bool nullToAbsent) {
    return StoreStaffGrantsCompanion(
      deviceId: Value(deviceId),
      operatorId: Value(operatorId),
      displayName: Value(displayName),
      role: Value(role),
      credentialHash: Value(credentialHash),
    );
  }

  factory StoreStaffGrant.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return StoreStaffGrant(
      deviceId: serializer.fromJson<String>(json['deviceId']),
      operatorId: serializer.fromJson<String>(json['operatorId']),
      displayName: serializer.fromJson<String>(json['displayName']),
      role: serializer.fromJson<String>(json['role']),
      credentialHash: serializer.fromJson<String>(json['credentialHash']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'deviceId': serializer.toJson<String>(deviceId),
      'operatorId': serializer.toJson<String>(operatorId),
      'displayName': serializer.toJson<String>(displayName),
      'role': serializer.toJson<String>(role),
      'credentialHash': serializer.toJson<String>(credentialHash),
    };
  }

  StoreStaffGrant copyWith({
    String? deviceId,
    String? operatorId,
    String? displayName,
    String? role,
    String? credentialHash,
  }) => StoreStaffGrant(
    deviceId: deviceId ?? this.deviceId,
    operatorId: operatorId ?? this.operatorId,
    displayName: displayName ?? this.displayName,
    role: role ?? this.role,
    credentialHash: credentialHash ?? this.credentialHash,
  );
  StoreStaffGrant copyWithCompanion(StoreStaffGrantsCompanion data) {
    return StoreStaffGrant(
      deviceId: data.deviceId.present ? data.deviceId.value : this.deviceId,
      operatorId: data.operatorId.present
          ? data.operatorId.value
          : this.operatorId,
      displayName: data.displayName.present
          ? data.displayName.value
          : this.displayName,
      role: data.role.present ? data.role.value : this.role,
      credentialHash: data.credentialHash.present
          ? data.credentialHash.value
          : this.credentialHash,
    );
  }

  @override
  String toString() {
    return (StringBuffer('StoreStaffGrant(')
          ..write('deviceId: $deviceId, ')
          ..write('operatorId: $operatorId, ')
          ..write('displayName: $displayName, ')
          ..write('role: $role, ')
          ..write('credentialHash: $credentialHash')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(deviceId, operatorId, displayName, role, credentialHash);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StoreStaffGrant &&
          other.deviceId == this.deviceId &&
          other.operatorId == this.operatorId &&
          other.displayName == this.displayName &&
          other.role == this.role &&
          other.credentialHash == this.credentialHash);
}

class StoreStaffGrantsCompanion extends UpdateCompanion<StoreStaffGrant> {
  final Value<String> deviceId;
  final Value<String> operatorId;
  final Value<String> displayName;
  final Value<String> role;
  final Value<String> credentialHash;
  final Value<int> rowid;
  const StoreStaffGrantsCompanion({
    this.deviceId = const Value.absent(),
    this.operatorId = const Value.absent(),
    this.displayName = const Value.absent(),
    this.role = const Value.absent(),
    this.credentialHash = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  StoreStaffGrantsCompanion.insert({
    required String deviceId,
    required String operatorId,
    required String displayName,
    required String role,
    required String credentialHash,
    this.rowid = const Value.absent(),
  }) : deviceId = Value(deviceId),
       operatorId = Value(operatorId),
       displayName = Value(displayName),
       role = Value(role),
       credentialHash = Value(credentialHash);
  static Insertable<StoreStaffGrant> custom({
    Expression<String>? deviceId,
    Expression<String>? operatorId,
    Expression<String>? displayName,
    Expression<String>? role,
    Expression<String>? credentialHash,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (deviceId != null) 'device_id': deviceId,
      if (operatorId != null) 'operator_id': operatorId,
      if (displayName != null) 'display_name': displayName,
      if (role != null) 'role': role,
      if (credentialHash != null) 'credential_hash': credentialHash,
      if (rowid != null) 'rowid': rowid,
    });
  }

  StoreStaffGrantsCompanion copyWith({
    Value<String>? deviceId,
    Value<String>? operatorId,
    Value<String>? displayName,
    Value<String>? role,
    Value<String>? credentialHash,
    Value<int>? rowid,
  }) {
    return StoreStaffGrantsCompanion(
      deviceId: deviceId ?? this.deviceId,
      operatorId: operatorId ?? this.operatorId,
      displayName: displayName ?? this.displayName,
      role: role ?? this.role,
      credentialHash: credentialHash ?? this.credentialHash,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (deviceId.present) {
      map['device_id'] = Variable<String>(deviceId.value);
    }
    if (operatorId.present) {
      map['operator_id'] = Variable<String>(operatorId.value);
    }
    if (displayName.present) {
      map['display_name'] = Variable<String>(displayName.value);
    }
    if (role.present) {
      map['role'] = Variable<String>(role.value);
    }
    if (credentialHash.present) {
      map['credential_hash'] = Variable<String>(credentialHash.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('StoreStaffGrantsCompanion(')
          ..write('deviceId: $deviceId, ')
          ..write('operatorId: $operatorId, ')
          ..write('displayName: $displayName, ')
          ..write('role: $role, ')
          ..write('credentialHash: $credentialHash, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $TillCommandsTable extends TillCommands
    with TableInfo<$TillCommandsTable, TillCommand> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $TillCommandsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _operatorIdMeta = const VerificationMeta(
    'operatorId',
  );
  @override
  late final GeneratedColumn<String> operatorId = GeneratedColumn<String>(
    'operator_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _commandIdMeta = const VerificationMeta(
    'commandId',
  );
  @override
  late final GeneratedColumn<String> commandId = GeneratedColumn<String>(
    'command_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _actionMeta = const VerificationMeta('action');
  @override
  late final GeneratedColumn<String> action = GeneratedColumn<String>(
    'action',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _payloadMeta = const VerificationMeta(
    'payload',
  );
  @override
  late final GeneratedColumn<String> payload = GeneratedColumn<String>(
    'payload',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    operatorId,
    commandId,
    action,
    payload,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'till_commands';
  @override
  VerificationContext validateIntegrity(
    Insertable<TillCommand> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('operator_id')) {
      context.handle(
        _operatorIdMeta,
        operatorId.isAcceptableOrUnknown(data['operator_id']!, _operatorIdMeta),
      );
    } else if (isInserting) {
      context.missing(_operatorIdMeta);
    }
    if (data.containsKey('command_id')) {
      context.handle(
        _commandIdMeta,
        commandId.isAcceptableOrUnknown(data['command_id']!, _commandIdMeta),
      );
    } else if (isInserting) {
      context.missing(_commandIdMeta);
    }
    if (data.containsKey('action')) {
      context.handle(
        _actionMeta,
        action.isAcceptableOrUnknown(data['action']!, _actionMeta),
      );
    } else if (isInserting) {
      context.missing(_actionMeta);
    }
    if (data.containsKey('payload')) {
      context.handle(
        _payloadMeta,
        payload.isAcceptableOrUnknown(data['payload']!, _payloadMeta),
      );
    } else if (isInserting) {
      context.missing(_payloadMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {operatorId};
  @override
  TillCommand map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return TillCommand(
      operatorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}operator_id'],
      )!,
      commandId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}command_id'],
      )!,
      action: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}action'],
      )!,
      payload: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}payload'],
      )!,
    );
  }

  @override
  $TillCommandsTable createAlias(String alias) {
    return $TillCommandsTable(attachedDatabase, alias);
  }
}

class TillCommand extends DataClass implements Insertable<TillCommand> {
  final String operatorId;
  final String commandId;
  final String action;
  final String payload;
  const TillCommand({
    required this.operatorId,
    required this.commandId,
    required this.action,
    required this.payload,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['operator_id'] = Variable<String>(operatorId);
    map['command_id'] = Variable<String>(commandId);
    map['action'] = Variable<String>(action);
    map['payload'] = Variable<String>(payload);
    return map;
  }

  TillCommandsCompanion toCompanion(bool nullToAbsent) {
    return TillCommandsCompanion(
      operatorId: Value(operatorId),
      commandId: Value(commandId),
      action: Value(action),
      payload: Value(payload),
    );
  }

  factory TillCommand.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return TillCommand(
      operatorId: serializer.fromJson<String>(json['operatorId']),
      commandId: serializer.fromJson<String>(json['commandId']),
      action: serializer.fromJson<String>(json['action']),
      payload: serializer.fromJson<String>(json['payload']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'operatorId': serializer.toJson<String>(operatorId),
      'commandId': serializer.toJson<String>(commandId),
      'action': serializer.toJson<String>(action),
      'payload': serializer.toJson<String>(payload),
    };
  }

  TillCommand copyWith({
    String? operatorId,
    String? commandId,
    String? action,
    String? payload,
  }) => TillCommand(
    operatorId: operatorId ?? this.operatorId,
    commandId: commandId ?? this.commandId,
    action: action ?? this.action,
    payload: payload ?? this.payload,
  );
  TillCommand copyWithCompanion(TillCommandsCompanion data) {
    return TillCommand(
      operatorId: data.operatorId.present
          ? data.operatorId.value
          : this.operatorId,
      commandId: data.commandId.present ? data.commandId.value : this.commandId,
      action: data.action.present ? data.action.value : this.action,
      payload: data.payload.present ? data.payload.value : this.payload,
    );
  }

  @override
  String toString() {
    return (StringBuffer('TillCommand(')
          ..write('operatorId: $operatorId, ')
          ..write('commandId: $commandId, ')
          ..write('action: $action, ')
          ..write('payload: $payload')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(operatorId, commandId, action, payload);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is TillCommand &&
          other.operatorId == this.operatorId &&
          other.commandId == this.commandId &&
          other.action == this.action &&
          other.payload == this.payload);
}

class TillCommandsCompanion extends UpdateCompanion<TillCommand> {
  final Value<String> operatorId;
  final Value<String> commandId;
  final Value<String> action;
  final Value<String> payload;
  final Value<int> rowid;
  const TillCommandsCompanion({
    this.operatorId = const Value.absent(),
    this.commandId = const Value.absent(),
    this.action = const Value.absent(),
    this.payload = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  TillCommandsCompanion.insert({
    required String operatorId,
    required String commandId,
    required String action,
    required String payload,
    this.rowid = const Value.absent(),
  }) : operatorId = Value(operatorId),
       commandId = Value(commandId),
       action = Value(action),
       payload = Value(payload);
  static Insertable<TillCommand> custom({
    Expression<String>? operatorId,
    Expression<String>? commandId,
    Expression<String>? action,
    Expression<String>? payload,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (operatorId != null) 'operator_id': operatorId,
      if (commandId != null) 'command_id': commandId,
      if (action != null) 'action': action,
      if (payload != null) 'payload': payload,
      if (rowid != null) 'rowid': rowid,
    });
  }

  TillCommandsCompanion copyWith({
    Value<String>? operatorId,
    Value<String>? commandId,
    Value<String>? action,
    Value<String>? payload,
    Value<int>? rowid,
  }) {
    return TillCommandsCompanion(
      operatorId: operatorId ?? this.operatorId,
      commandId: commandId ?? this.commandId,
      action: action ?? this.action,
      payload: payload ?? this.payload,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (operatorId.present) {
      map['operator_id'] = Variable<String>(operatorId.value);
    }
    if (commandId.present) {
      map['command_id'] = Variable<String>(commandId.value);
    }
    if (action.present) {
      map['action'] = Variable<String>(action.value);
    }
    if (payload.present) {
      map['payload'] = Variable<String>(payload.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('TillCommandsCompanion(')
          ..write('operatorId: $operatorId, ')
          ..write('commandId: $commandId, ')
          ..write('action: $action, ')
          ..write('payload: $payload, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

class $ReceiptPrintsTable extends ReceiptPrints
    with TableInfo<$ReceiptPrintsTable, ReceiptPrint> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $ReceiptPrintsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    hasAutoIncrement: true,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultConstraints: GeneratedColumn.constraintIsAlways(
      'PRIMARY KEY AUTOINCREMENT',
    ),
  );
  static const VerificationMeta _saleIdMeta = const VerificationMeta('saleId');
  @override
  late final GeneratedColumn<String> saleId = GeneratedColumn<String>(
    'sale_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _operatorIdMeta = const VerificationMeta(
    'operatorId',
  );
  @override
  late final GeneratedColumn<String> operatorId = GeneratedColumn<String>(
    'operator_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _copiesMeta = const VerificationMeta('copies');
  @override
  late final GeneratedColumn<int> copies = GeneratedColumn<int>(
    'copies',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sentAtMeta = const VerificationMeta('sentAt');
  @override
  late final GeneratedColumn<DateTime> sentAt = GeneratedColumn<DateTime>(
    'sent_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    saleId,
    operatorId,
    copies,
    sentAt,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'receipt_prints';
  @override
  VerificationContext validateIntegrity(
    Insertable<ReceiptPrint> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('sale_id')) {
      context.handle(
        _saleIdMeta,
        saleId.isAcceptableOrUnknown(data['sale_id']!, _saleIdMeta),
      );
    } else if (isInserting) {
      context.missing(_saleIdMeta);
    }
    if (data.containsKey('operator_id')) {
      context.handle(
        _operatorIdMeta,
        operatorId.isAcceptableOrUnknown(data['operator_id']!, _operatorIdMeta),
      );
    } else if (isInserting) {
      context.missing(_operatorIdMeta);
    }
    if (data.containsKey('copies')) {
      context.handle(
        _copiesMeta,
        copies.isAcceptableOrUnknown(data['copies']!, _copiesMeta),
      );
    } else if (isInserting) {
      context.missing(_copiesMeta);
    }
    if (data.containsKey('sent_at')) {
      context.handle(
        _sentAtMeta,
        sentAt.isAcceptableOrUnknown(data['sent_at']!, _sentAtMeta),
      );
    } else if (isInserting) {
      context.missing(_sentAtMeta);
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  ReceiptPrint map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return ReceiptPrint(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      saleId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}sale_id'],
      )!,
      operatorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}operator_id'],
      )!,
      copies: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}copies'],
      )!,
      sentAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}sent_at'],
      )!,
    );
  }

  @override
  $ReceiptPrintsTable createAlias(String alias) {
    return $ReceiptPrintsTable(attachedDatabase, alias);
  }
}

class ReceiptPrint extends DataClass implements Insertable<ReceiptPrint> {
  final int id;
  final String saleId;
  final String operatorId;
  final int copies;
  final DateTime sentAt;
  const ReceiptPrint({
    required this.id,
    required this.saleId,
    required this.operatorId,
    required this.copies,
    required this.sentAt,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['sale_id'] = Variable<String>(saleId);
    map['operator_id'] = Variable<String>(operatorId);
    map['copies'] = Variable<int>(copies);
    map['sent_at'] = Variable<DateTime>(sentAt);
    return map;
  }

  ReceiptPrintsCompanion toCompanion(bool nullToAbsent) {
    return ReceiptPrintsCompanion(
      id: Value(id),
      saleId: Value(saleId),
      operatorId: Value(operatorId),
      copies: Value(copies),
      sentAt: Value(sentAt),
    );
  }

  factory ReceiptPrint.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return ReceiptPrint(
      id: serializer.fromJson<int>(json['id']),
      saleId: serializer.fromJson<String>(json['saleId']),
      operatorId: serializer.fromJson<String>(json['operatorId']),
      copies: serializer.fromJson<int>(json['copies']),
      sentAt: serializer.fromJson<DateTime>(json['sentAt']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'saleId': serializer.toJson<String>(saleId),
      'operatorId': serializer.toJson<String>(operatorId),
      'copies': serializer.toJson<int>(copies),
      'sentAt': serializer.toJson<DateTime>(sentAt),
    };
  }

  ReceiptPrint copyWith({
    int? id,
    String? saleId,
    String? operatorId,
    int? copies,
    DateTime? sentAt,
  }) => ReceiptPrint(
    id: id ?? this.id,
    saleId: saleId ?? this.saleId,
    operatorId: operatorId ?? this.operatorId,
    copies: copies ?? this.copies,
    sentAt: sentAt ?? this.sentAt,
  );
  ReceiptPrint copyWithCompanion(ReceiptPrintsCompanion data) {
    return ReceiptPrint(
      id: data.id.present ? data.id.value : this.id,
      saleId: data.saleId.present ? data.saleId.value : this.saleId,
      operatorId: data.operatorId.present
          ? data.operatorId.value
          : this.operatorId,
      copies: data.copies.present ? data.copies.value : this.copies,
      sentAt: data.sentAt.present ? data.sentAt.value : this.sentAt,
    );
  }

  @override
  String toString() {
    return (StringBuffer('ReceiptPrint(')
          ..write('id: $id, ')
          ..write('saleId: $saleId, ')
          ..write('operatorId: $operatorId, ')
          ..write('copies: $copies, ')
          ..write('sentAt: $sentAt')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(id, saleId, operatorId, copies, sentAt);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is ReceiptPrint &&
          other.id == this.id &&
          other.saleId == this.saleId &&
          other.operatorId == this.operatorId &&
          other.copies == this.copies &&
          other.sentAt == this.sentAt);
}

class ReceiptPrintsCompanion extends UpdateCompanion<ReceiptPrint> {
  final Value<int> id;
  final Value<String> saleId;
  final Value<String> operatorId;
  final Value<int> copies;
  final Value<DateTime> sentAt;
  const ReceiptPrintsCompanion({
    this.id = const Value.absent(),
    this.saleId = const Value.absent(),
    this.operatorId = const Value.absent(),
    this.copies = const Value.absent(),
    this.sentAt = const Value.absent(),
  });
  ReceiptPrintsCompanion.insert({
    this.id = const Value.absent(),
    required String saleId,
    required String operatorId,
    required int copies,
    required DateTime sentAt,
  }) : saleId = Value(saleId),
       operatorId = Value(operatorId),
       copies = Value(copies),
       sentAt = Value(sentAt);
  static Insertable<ReceiptPrint> custom({
    Expression<int>? id,
    Expression<String>? saleId,
    Expression<String>? operatorId,
    Expression<int>? copies,
    Expression<DateTime>? sentAt,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (saleId != null) 'sale_id': saleId,
      if (operatorId != null) 'operator_id': operatorId,
      if (copies != null) 'copies': copies,
      if (sentAt != null) 'sent_at': sentAt,
    });
  }

  ReceiptPrintsCompanion copyWith({
    Value<int>? id,
    Value<String>? saleId,
    Value<String>? operatorId,
    Value<int>? copies,
    Value<DateTime>? sentAt,
  }) {
    return ReceiptPrintsCompanion(
      id: id ?? this.id,
      saleId: saleId ?? this.saleId,
      operatorId: operatorId ?? this.operatorId,
      copies: copies ?? this.copies,
      sentAt: sentAt ?? this.sentAt,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (saleId.present) {
      map['sale_id'] = Variable<String>(saleId.value);
    }
    if (operatorId.present) {
      map['operator_id'] = Variable<String>(operatorId.value);
    }
    if (copies.present) {
      map['copies'] = Variable<int>(copies.value);
    }
    if (sentAt.present) {
      map['sent_at'] = Variable<DateTime>(sentAt.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('ReceiptPrintsCompanion(')
          ..write('id: $id, ')
          ..write('saleId: $saleId, ')
          ..write('operatorId: $operatorId, ')
          ..write('copies: $copies, ')
          ..write('sentAt: $sentAt')
          ..write(')'))
        .toString();
  }
}

class $StoreOperatingStatesTable extends StoreOperatingStates
    with TableInfo<$StoreOperatingStatesTable, StoreOperatingState> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $StoreOperatingStatesTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _idMeta = const VerificationMeta('id');
  @override
  late final GeneratedColumn<int> id = GeneratedColumn<int>(
    'id',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(1),
  );
  static const VerificationMeta _epochMeta = const VerificationMeta('epoch');
  @override
  late final GeneratedColumn<String> epoch = GeneratedColumn<String>(
    'epoch',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _timezoneMeta = const VerificationMeta(
    'timezone',
  );
  @override
  late final GeneratedColumn<String> timezone = GeneratedColumn<String>(
    'timezone',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sequenceMeta = const VerificationMeta(
    'sequence',
  );
  @override
  late final GeneratedColumn<int> sequence = GeneratedColumn<int>(
    'sequence',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _phaseMeta = const VerificationMeta('phase');
  @override
  late final GeneratedColumn<String> phase = GeneratedColumn<String>(
    'phase',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('active'),
  );
  static const VerificationMeta _activityMeta = const VerificationMeta(
    'activity',
  );
  @override
  late final GeneratedColumn<String> activity = GeneratedColumn<String>(
    'activity',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('{}'),
  );
  @override
  List<GeneratedColumn> get $columns => [
    id,
    epoch,
    timezone,
    sequence,
    phase,
    activity,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'store_operating_states';
  @override
  VerificationContext validateIntegrity(
    Insertable<StoreOperatingState> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('id')) {
      context.handle(_idMeta, id.isAcceptableOrUnknown(data['id']!, _idMeta));
    }
    if (data.containsKey('epoch')) {
      context.handle(
        _epochMeta,
        epoch.isAcceptableOrUnknown(data['epoch']!, _epochMeta),
      );
    } else if (isInserting) {
      context.missing(_epochMeta);
    }
    if (data.containsKey('timezone')) {
      context.handle(
        _timezoneMeta,
        timezone.isAcceptableOrUnknown(data['timezone']!, _timezoneMeta),
      );
    } else if (isInserting) {
      context.missing(_timezoneMeta);
    }
    if (data.containsKey('sequence')) {
      context.handle(
        _sequenceMeta,
        sequence.isAcceptableOrUnknown(data['sequence']!, _sequenceMeta),
      );
    }
    if (data.containsKey('phase')) {
      context.handle(
        _phaseMeta,
        phase.isAcceptableOrUnknown(data['phase']!, _phaseMeta),
      );
    }
    if (data.containsKey('activity')) {
      context.handle(
        _activityMeta,
        activity.isAcceptableOrUnknown(data['activity']!, _activityMeta),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {id};
  @override
  StoreOperatingState map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return StoreOperatingState(
      id: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}id'],
      )!,
      epoch: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}epoch'],
      )!,
      timezone: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}timezone'],
      )!,
      sequence: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}sequence'],
      )!,
      phase: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}phase'],
      )!,
      activity: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}activity'],
      )!,
    );
  }

  @override
  $StoreOperatingStatesTable createAlias(String alias) {
    return $StoreOperatingStatesTable(attachedDatabase, alias);
  }
}

class StoreOperatingState extends DataClass
    implements Insertable<StoreOperatingState> {
  final int id;
  final String epoch;
  final String timezone;
  final int sequence;
  final String phase;
  final String activity;
  const StoreOperatingState({
    required this.id,
    required this.epoch,
    required this.timezone,
    required this.sequence,
    required this.phase,
    required this.activity,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['id'] = Variable<int>(id);
    map['epoch'] = Variable<String>(epoch);
    map['timezone'] = Variable<String>(timezone);
    map['sequence'] = Variable<int>(sequence);
    map['phase'] = Variable<String>(phase);
    map['activity'] = Variable<String>(activity);
    return map;
  }

  StoreOperatingStatesCompanion toCompanion(bool nullToAbsent) {
    return StoreOperatingStatesCompanion(
      id: Value(id),
      epoch: Value(epoch),
      timezone: Value(timezone),
      sequence: Value(sequence),
      phase: Value(phase),
      activity: Value(activity),
    );
  }

  factory StoreOperatingState.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return StoreOperatingState(
      id: serializer.fromJson<int>(json['id']),
      epoch: serializer.fromJson<String>(json['epoch']),
      timezone: serializer.fromJson<String>(json['timezone']),
      sequence: serializer.fromJson<int>(json['sequence']),
      phase: serializer.fromJson<String>(json['phase']),
      activity: serializer.fromJson<String>(json['activity']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'id': serializer.toJson<int>(id),
      'epoch': serializer.toJson<String>(epoch),
      'timezone': serializer.toJson<String>(timezone),
      'sequence': serializer.toJson<int>(sequence),
      'phase': serializer.toJson<String>(phase),
      'activity': serializer.toJson<String>(activity),
    };
  }

  StoreOperatingState copyWith({
    int? id,
    String? epoch,
    String? timezone,
    int? sequence,
    String? phase,
    String? activity,
  }) => StoreOperatingState(
    id: id ?? this.id,
    epoch: epoch ?? this.epoch,
    timezone: timezone ?? this.timezone,
    sequence: sequence ?? this.sequence,
    phase: phase ?? this.phase,
    activity: activity ?? this.activity,
  );
  StoreOperatingState copyWithCompanion(StoreOperatingStatesCompanion data) {
    return StoreOperatingState(
      id: data.id.present ? data.id.value : this.id,
      epoch: data.epoch.present ? data.epoch.value : this.epoch,
      timezone: data.timezone.present ? data.timezone.value : this.timezone,
      sequence: data.sequence.present ? data.sequence.value : this.sequence,
      phase: data.phase.present ? data.phase.value : this.phase,
      activity: data.activity.present ? data.activity.value : this.activity,
    );
  }

  @override
  String toString() {
    return (StringBuffer('StoreOperatingState(')
          ..write('id: $id, ')
          ..write('epoch: $epoch, ')
          ..write('timezone: $timezone, ')
          ..write('sequence: $sequence, ')
          ..write('phase: $phase, ')
          ..write('activity: $activity')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode =>
      Object.hash(id, epoch, timezone, sequence, phase, activity);
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StoreOperatingState &&
          other.id == this.id &&
          other.epoch == this.epoch &&
          other.timezone == this.timezone &&
          other.sequence == this.sequence &&
          other.phase == this.phase &&
          other.activity == this.activity);
}

class StoreOperatingStatesCompanion
    extends UpdateCompanion<StoreOperatingState> {
  final Value<int> id;
  final Value<String> epoch;
  final Value<String> timezone;
  final Value<int> sequence;
  final Value<String> phase;
  final Value<String> activity;
  const StoreOperatingStatesCompanion({
    this.id = const Value.absent(),
    this.epoch = const Value.absent(),
    this.timezone = const Value.absent(),
    this.sequence = const Value.absent(),
    this.phase = const Value.absent(),
    this.activity = const Value.absent(),
  });
  StoreOperatingStatesCompanion.insert({
    this.id = const Value.absent(),
    required String epoch,
    required String timezone,
    this.sequence = const Value.absent(),
    this.phase = const Value.absent(),
    this.activity = const Value.absent(),
  }) : epoch = Value(epoch),
       timezone = Value(timezone);
  static Insertable<StoreOperatingState> custom({
    Expression<int>? id,
    Expression<String>? epoch,
    Expression<String>? timezone,
    Expression<int>? sequence,
    Expression<String>? phase,
    Expression<String>? activity,
  }) {
    return RawValuesInsertable({
      if (id != null) 'id': id,
      if (epoch != null) 'epoch': epoch,
      if (timezone != null) 'timezone': timezone,
      if (sequence != null) 'sequence': sequence,
      if (phase != null) 'phase': phase,
      if (activity != null) 'activity': activity,
    });
  }

  StoreOperatingStatesCompanion copyWith({
    Value<int>? id,
    Value<String>? epoch,
    Value<String>? timezone,
    Value<int>? sequence,
    Value<String>? phase,
    Value<String>? activity,
  }) {
    return StoreOperatingStatesCompanion(
      id: id ?? this.id,
      epoch: epoch ?? this.epoch,
      timezone: timezone ?? this.timezone,
      sequence: sequence ?? this.sequence,
      phase: phase ?? this.phase,
      activity: activity ?? this.activity,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (id.present) {
      map['id'] = Variable<int>(id.value);
    }
    if (epoch.present) {
      map['epoch'] = Variable<String>(epoch.value);
    }
    if (timezone.present) {
      map['timezone'] = Variable<String>(timezone.value);
    }
    if (sequence.present) {
      map['sequence'] = Variable<int>(sequence.value);
    }
    if (phase.present) {
      map['phase'] = Variable<String>(phase.value);
    }
    if (activity.present) {
      map['activity'] = Variable<String>(activity.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('StoreOperatingStatesCompanion(')
          ..write('id: $id, ')
          ..write('epoch: $epoch, ')
          ..write('timezone: $timezone, ')
          ..write('sequence: $sequence, ')
          ..write('phase: $phase, ')
          ..write('activity: $activity')
          ..write(')'))
        .toString();
  }
}

class $StoreOperatingEventsTable extends StoreOperatingEvents
    with TableInfo<$StoreOperatingEventsTable, StoreOperatingEvent> {
  @override
  final GeneratedDatabase attachedDatabase;
  final String? _alias;
  $StoreOperatingEventsTable(this.attachedDatabase, [this._alias]);
  static const VerificationMeta _epochMeta = const VerificationMeta('epoch');
  @override
  late final GeneratedColumn<String> epoch = GeneratedColumn<String>(
    'epoch',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _sequenceMeta = const VerificationMeta(
    'sequence',
  );
  @override
  late final GeneratedColumn<int> sequence = GeneratedColumn<int>(
    'sequence',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _commandIdMeta = const VerificationMeta(
    'commandId',
  );
  @override
  late final GeneratedColumn<String> commandId = GeneratedColumn<String>(
    'command_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
    defaultConstraints: GeneratedColumn.constraintIsAlways('UNIQUE'),
  );
  static const VerificationMeta _resourceIdMeta = const VerificationMeta(
    'resourceId',
  );
  @override
  late final GeneratedColumn<String> resourceId = GeneratedColumn<String>(
    'resource_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _operatorIdMeta = const VerificationMeta(
    'operatorId',
  );
  @override
  late final GeneratedColumn<String> operatorId = GeneratedColumn<String>(
    'operator_id',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _operatorNameMeta = const VerificationMeta(
    'operatorName',
  );
  @override
  late final GeneratedColumn<String> operatorName = GeneratedColumn<String>(
    'operator_name',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _profileIdMeta = const VerificationMeta(
    'profileId',
  );
  @override
  late final GeneratedColumn<String> profileId = GeneratedColumn<String>(
    'profile_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _kindMeta = const VerificationMeta('kind');
  @override
  late final GeneratedColumn<String> kind = GeneratedColumn<String>(
    'kind',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _envelopeMeta = const VerificationMeta(
    'envelope',
  );
  @override
  late final GeneratedColumn<String> envelope = GeneratedColumn<String>(
    'envelope',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _statusMeta = const VerificationMeta('status');
  @override
  late final GeneratedColumn<String> status = GeneratedColumn<String>(
    'status',
    aliasedName,
    false,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
    defaultValue: const Constant('pending'),
  );
  static const VerificationMeta _attemptsMeta = const VerificationMeta(
    'attempts',
  );
  @override
  late final GeneratedColumn<int> attempts = GeneratedColumn<int>(
    'attempts',
    aliasedName,
    false,
    type: DriftSqlType.int,
    requiredDuringInsert: false,
    defaultValue: const Constant(0),
  );
  static const VerificationMeta _retryAtMeta = const VerificationMeta(
    'retryAt',
  );
  @override
  late final GeneratedColumn<DateTime> retryAt = GeneratedColumn<DateTime>(
    'retry_at',
    aliasedName,
    false,
    type: DriftSqlType.dateTime,
    requiredDuringInsert: true,
  );
  static const VerificationMeta _lastErrorMeta = const VerificationMeta(
    'lastError',
  );
  @override
  late final GeneratedColumn<String> lastError = GeneratedColumn<String>(
    'last_error',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _acknowledgmentMeta = const VerificationMeta(
    'acknowledgment',
  );
  @override
  late final GeneratedColumn<String> acknowledgment = GeneratedColumn<String>(
    'acknowledgment',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _recoveryOwnerIdMeta = const VerificationMeta(
    'recoveryOwnerId',
  );
  @override
  late final GeneratedColumn<String> recoveryOwnerId = GeneratedColumn<String>(
    'recovery_owner_id',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  static const VerificationMeta _recoveryReasonMeta = const VerificationMeta(
    'recoveryReason',
  );
  @override
  late final GeneratedColumn<String> recoveryReason = GeneratedColumn<String>(
    'recovery_reason',
    aliasedName,
    true,
    type: DriftSqlType.string,
    requiredDuringInsert: false,
  );
  @override
  List<GeneratedColumn> get $columns => [
    epoch,
    sequence,
    commandId,
    resourceId,
    operatorId,
    operatorName,
    profileId,
    kind,
    envelope,
    status,
    attempts,
    retryAt,
    lastError,
    acknowledgment,
    recoveryOwnerId,
    recoveryReason,
  ];
  @override
  String get aliasedName => _alias ?? actualTableName;
  @override
  String get actualTableName => $name;
  static const String $name = 'store_operating_events';
  @override
  VerificationContext validateIntegrity(
    Insertable<StoreOperatingEvent> instance, {
    bool isInserting = false,
  }) {
    final context = VerificationContext();
    final data = instance.toColumns(true);
    if (data.containsKey('epoch')) {
      context.handle(
        _epochMeta,
        epoch.isAcceptableOrUnknown(data['epoch']!, _epochMeta),
      );
    } else if (isInserting) {
      context.missing(_epochMeta);
    }
    if (data.containsKey('sequence')) {
      context.handle(
        _sequenceMeta,
        sequence.isAcceptableOrUnknown(data['sequence']!, _sequenceMeta),
      );
    } else if (isInserting) {
      context.missing(_sequenceMeta);
    }
    if (data.containsKey('command_id')) {
      context.handle(
        _commandIdMeta,
        commandId.isAcceptableOrUnknown(data['command_id']!, _commandIdMeta),
      );
    } else if (isInserting) {
      context.missing(_commandIdMeta);
    }
    if (data.containsKey('resource_id')) {
      context.handle(
        _resourceIdMeta,
        resourceId.isAcceptableOrUnknown(data['resource_id']!, _resourceIdMeta),
      );
    } else if (isInserting) {
      context.missing(_resourceIdMeta);
    }
    if (data.containsKey('operator_id')) {
      context.handle(
        _operatorIdMeta,
        operatorId.isAcceptableOrUnknown(data['operator_id']!, _operatorIdMeta),
      );
    } else if (isInserting) {
      context.missing(_operatorIdMeta);
    }
    if (data.containsKey('operator_name')) {
      context.handle(
        _operatorNameMeta,
        operatorName.isAcceptableOrUnknown(
          data['operator_name']!,
          _operatorNameMeta,
        ),
      );
    }
    if (data.containsKey('profile_id')) {
      context.handle(
        _profileIdMeta,
        profileId.isAcceptableOrUnknown(data['profile_id']!, _profileIdMeta),
      );
    }
    if (data.containsKey('kind')) {
      context.handle(
        _kindMeta,
        kind.isAcceptableOrUnknown(data['kind']!, _kindMeta),
      );
    } else if (isInserting) {
      context.missing(_kindMeta);
    }
    if (data.containsKey('envelope')) {
      context.handle(
        _envelopeMeta,
        envelope.isAcceptableOrUnknown(data['envelope']!, _envelopeMeta),
      );
    } else if (isInserting) {
      context.missing(_envelopeMeta);
    }
    if (data.containsKey('status')) {
      context.handle(
        _statusMeta,
        status.isAcceptableOrUnknown(data['status']!, _statusMeta),
      );
    }
    if (data.containsKey('attempts')) {
      context.handle(
        _attemptsMeta,
        attempts.isAcceptableOrUnknown(data['attempts']!, _attemptsMeta),
      );
    }
    if (data.containsKey('retry_at')) {
      context.handle(
        _retryAtMeta,
        retryAt.isAcceptableOrUnknown(data['retry_at']!, _retryAtMeta),
      );
    } else if (isInserting) {
      context.missing(_retryAtMeta);
    }
    if (data.containsKey('last_error')) {
      context.handle(
        _lastErrorMeta,
        lastError.isAcceptableOrUnknown(data['last_error']!, _lastErrorMeta),
      );
    }
    if (data.containsKey('acknowledgment')) {
      context.handle(
        _acknowledgmentMeta,
        acknowledgment.isAcceptableOrUnknown(
          data['acknowledgment']!,
          _acknowledgmentMeta,
        ),
      );
    }
    if (data.containsKey('recovery_owner_id')) {
      context.handle(
        _recoveryOwnerIdMeta,
        recoveryOwnerId.isAcceptableOrUnknown(
          data['recovery_owner_id']!,
          _recoveryOwnerIdMeta,
        ),
      );
    }
    if (data.containsKey('recovery_reason')) {
      context.handle(
        _recoveryReasonMeta,
        recoveryReason.isAcceptableOrUnknown(
          data['recovery_reason']!,
          _recoveryReasonMeta,
        ),
      );
    }
    return context;
  }

  @override
  Set<GeneratedColumn> get $primaryKey => {epoch, sequence};
  @override
  StoreOperatingEvent map(Map<String, dynamic> data, {String? tablePrefix}) {
    final effectivePrefix = tablePrefix != null ? '$tablePrefix.' : '';
    return StoreOperatingEvent(
      epoch: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}epoch'],
      )!,
      sequence: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}sequence'],
      )!,
      commandId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}command_id'],
      )!,
      resourceId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}resource_id'],
      )!,
      operatorId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}operator_id'],
      )!,
      operatorName: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}operator_name'],
      ),
      profileId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}profile_id'],
      ),
      kind: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}kind'],
      )!,
      envelope: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}envelope'],
      )!,
      status: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}status'],
      )!,
      attempts: attachedDatabase.typeMapping.read(
        DriftSqlType.int,
        data['${effectivePrefix}attempts'],
      )!,
      retryAt: attachedDatabase.typeMapping.read(
        DriftSqlType.dateTime,
        data['${effectivePrefix}retry_at'],
      )!,
      lastError: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}last_error'],
      ),
      acknowledgment: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}acknowledgment'],
      ),
      recoveryOwnerId: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}recovery_owner_id'],
      ),
      recoveryReason: attachedDatabase.typeMapping.read(
        DriftSqlType.string,
        data['${effectivePrefix}recovery_reason'],
      ),
    );
  }

  @override
  $StoreOperatingEventsTable createAlias(String alias) {
    return $StoreOperatingEventsTable(attachedDatabase, alias);
  }
}

class StoreOperatingEvent extends DataClass
    implements Insertable<StoreOperatingEvent> {
  final String epoch;
  final int sequence;
  final String commandId;
  final String resourceId;
  final String operatorId;
  final String? operatorName;
  final String? profileId;
  final String kind;
  final String envelope;
  final String status;
  final int attempts;
  final DateTime retryAt;
  final String? lastError;
  final String? acknowledgment;
  final String? recoveryOwnerId;
  final String? recoveryReason;
  const StoreOperatingEvent({
    required this.epoch,
    required this.sequence,
    required this.commandId,
    required this.resourceId,
    required this.operatorId,
    this.operatorName,
    this.profileId,
    required this.kind,
    required this.envelope,
    required this.status,
    required this.attempts,
    required this.retryAt,
    this.lastError,
    this.acknowledgment,
    this.recoveryOwnerId,
    this.recoveryReason,
  });
  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    map['epoch'] = Variable<String>(epoch);
    map['sequence'] = Variable<int>(sequence);
    map['command_id'] = Variable<String>(commandId);
    map['resource_id'] = Variable<String>(resourceId);
    map['operator_id'] = Variable<String>(operatorId);
    if (!nullToAbsent || operatorName != null) {
      map['operator_name'] = Variable<String>(operatorName);
    }
    if (!nullToAbsent || profileId != null) {
      map['profile_id'] = Variable<String>(profileId);
    }
    map['kind'] = Variable<String>(kind);
    map['envelope'] = Variable<String>(envelope);
    map['status'] = Variable<String>(status);
    map['attempts'] = Variable<int>(attempts);
    map['retry_at'] = Variable<DateTime>(retryAt);
    if (!nullToAbsent || lastError != null) {
      map['last_error'] = Variable<String>(lastError);
    }
    if (!nullToAbsent || acknowledgment != null) {
      map['acknowledgment'] = Variable<String>(acknowledgment);
    }
    if (!nullToAbsent || recoveryOwnerId != null) {
      map['recovery_owner_id'] = Variable<String>(recoveryOwnerId);
    }
    if (!nullToAbsent || recoveryReason != null) {
      map['recovery_reason'] = Variable<String>(recoveryReason);
    }
    return map;
  }

  StoreOperatingEventsCompanion toCompanion(bool nullToAbsent) {
    return StoreOperatingEventsCompanion(
      epoch: Value(epoch),
      sequence: Value(sequence),
      commandId: Value(commandId),
      resourceId: Value(resourceId),
      operatorId: Value(operatorId),
      operatorName: operatorName == null && nullToAbsent
          ? const Value.absent()
          : Value(operatorName),
      profileId: profileId == null && nullToAbsent
          ? const Value.absent()
          : Value(profileId),
      kind: Value(kind),
      envelope: Value(envelope),
      status: Value(status),
      attempts: Value(attempts),
      retryAt: Value(retryAt),
      lastError: lastError == null && nullToAbsent
          ? const Value.absent()
          : Value(lastError),
      acknowledgment: acknowledgment == null && nullToAbsent
          ? const Value.absent()
          : Value(acknowledgment),
      recoveryOwnerId: recoveryOwnerId == null && nullToAbsent
          ? const Value.absent()
          : Value(recoveryOwnerId),
      recoveryReason: recoveryReason == null && nullToAbsent
          ? const Value.absent()
          : Value(recoveryReason),
    );
  }

  factory StoreOperatingEvent.fromJson(
    Map<String, dynamic> json, {
    ValueSerializer? serializer,
  }) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return StoreOperatingEvent(
      epoch: serializer.fromJson<String>(json['epoch']),
      sequence: serializer.fromJson<int>(json['sequence']),
      commandId: serializer.fromJson<String>(json['commandId']),
      resourceId: serializer.fromJson<String>(json['resourceId']),
      operatorId: serializer.fromJson<String>(json['operatorId']),
      operatorName: serializer.fromJson<String?>(json['operatorName']),
      profileId: serializer.fromJson<String?>(json['profileId']),
      kind: serializer.fromJson<String>(json['kind']),
      envelope: serializer.fromJson<String>(json['envelope']),
      status: serializer.fromJson<String>(json['status']),
      attempts: serializer.fromJson<int>(json['attempts']),
      retryAt: serializer.fromJson<DateTime>(json['retryAt']),
      lastError: serializer.fromJson<String?>(json['lastError']),
      acknowledgment: serializer.fromJson<String?>(json['acknowledgment']),
      recoveryOwnerId: serializer.fromJson<String?>(json['recoveryOwnerId']),
      recoveryReason: serializer.fromJson<String?>(json['recoveryReason']),
    );
  }
  @override
  Map<String, dynamic> toJson({ValueSerializer? serializer}) {
    serializer ??= driftRuntimeOptions.defaultSerializer;
    return <String, dynamic>{
      'epoch': serializer.toJson<String>(epoch),
      'sequence': serializer.toJson<int>(sequence),
      'commandId': serializer.toJson<String>(commandId),
      'resourceId': serializer.toJson<String>(resourceId),
      'operatorId': serializer.toJson<String>(operatorId),
      'operatorName': serializer.toJson<String?>(operatorName),
      'profileId': serializer.toJson<String?>(profileId),
      'kind': serializer.toJson<String>(kind),
      'envelope': serializer.toJson<String>(envelope),
      'status': serializer.toJson<String>(status),
      'attempts': serializer.toJson<int>(attempts),
      'retryAt': serializer.toJson<DateTime>(retryAt),
      'lastError': serializer.toJson<String?>(lastError),
      'acknowledgment': serializer.toJson<String?>(acknowledgment),
      'recoveryOwnerId': serializer.toJson<String?>(recoveryOwnerId),
      'recoveryReason': serializer.toJson<String?>(recoveryReason),
    };
  }

  StoreOperatingEvent copyWith({
    String? epoch,
    int? sequence,
    String? commandId,
    String? resourceId,
    String? operatorId,
    Value<String?> operatorName = const Value.absent(),
    Value<String?> profileId = const Value.absent(),
    String? kind,
    String? envelope,
    String? status,
    int? attempts,
    DateTime? retryAt,
    Value<String?> lastError = const Value.absent(),
    Value<String?> acknowledgment = const Value.absent(),
    Value<String?> recoveryOwnerId = const Value.absent(),
    Value<String?> recoveryReason = const Value.absent(),
  }) => StoreOperatingEvent(
    epoch: epoch ?? this.epoch,
    sequence: sequence ?? this.sequence,
    commandId: commandId ?? this.commandId,
    resourceId: resourceId ?? this.resourceId,
    operatorId: operatorId ?? this.operatorId,
    operatorName: operatorName.present ? operatorName.value : this.operatorName,
    profileId: profileId.present ? profileId.value : this.profileId,
    kind: kind ?? this.kind,
    envelope: envelope ?? this.envelope,
    status: status ?? this.status,
    attempts: attempts ?? this.attempts,
    retryAt: retryAt ?? this.retryAt,
    lastError: lastError.present ? lastError.value : this.lastError,
    acknowledgment: acknowledgment.present
        ? acknowledgment.value
        : this.acknowledgment,
    recoveryOwnerId: recoveryOwnerId.present
        ? recoveryOwnerId.value
        : this.recoveryOwnerId,
    recoveryReason: recoveryReason.present
        ? recoveryReason.value
        : this.recoveryReason,
  );
  StoreOperatingEvent copyWithCompanion(StoreOperatingEventsCompanion data) {
    return StoreOperatingEvent(
      epoch: data.epoch.present ? data.epoch.value : this.epoch,
      sequence: data.sequence.present ? data.sequence.value : this.sequence,
      commandId: data.commandId.present ? data.commandId.value : this.commandId,
      resourceId: data.resourceId.present
          ? data.resourceId.value
          : this.resourceId,
      operatorId: data.operatorId.present
          ? data.operatorId.value
          : this.operatorId,
      operatorName: data.operatorName.present
          ? data.operatorName.value
          : this.operatorName,
      profileId: data.profileId.present ? data.profileId.value : this.profileId,
      kind: data.kind.present ? data.kind.value : this.kind,
      envelope: data.envelope.present ? data.envelope.value : this.envelope,
      status: data.status.present ? data.status.value : this.status,
      attempts: data.attempts.present ? data.attempts.value : this.attempts,
      retryAt: data.retryAt.present ? data.retryAt.value : this.retryAt,
      lastError: data.lastError.present ? data.lastError.value : this.lastError,
      acknowledgment: data.acknowledgment.present
          ? data.acknowledgment.value
          : this.acknowledgment,
      recoveryOwnerId: data.recoveryOwnerId.present
          ? data.recoveryOwnerId.value
          : this.recoveryOwnerId,
      recoveryReason: data.recoveryReason.present
          ? data.recoveryReason.value
          : this.recoveryReason,
    );
  }

  @override
  String toString() {
    return (StringBuffer('StoreOperatingEvent(')
          ..write('epoch: $epoch, ')
          ..write('sequence: $sequence, ')
          ..write('commandId: $commandId, ')
          ..write('resourceId: $resourceId, ')
          ..write('operatorId: $operatorId, ')
          ..write('operatorName: $operatorName, ')
          ..write('profileId: $profileId, ')
          ..write('kind: $kind, ')
          ..write('envelope: $envelope, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('retryAt: $retryAt, ')
          ..write('lastError: $lastError, ')
          ..write('acknowledgment: $acknowledgment, ')
          ..write('recoveryOwnerId: $recoveryOwnerId, ')
          ..write('recoveryReason: $recoveryReason')
          ..write(')'))
        .toString();
  }

  @override
  int get hashCode => Object.hash(
    epoch,
    sequence,
    commandId,
    resourceId,
    operatorId,
    operatorName,
    profileId,
    kind,
    envelope,
    status,
    attempts,
    retryAt,
    lastError,
    acknowledgment,
    recoveryOwnerId,
    recoveryReason,
  );
  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      (other is StoreOperatingEvent &&
          other.epoch == this.epoch &&
          other.sequence == this.sequence &&
          other.commandId == this.commandId &&
          other.resourceId == this.resourceId &&
          other.operatorId == this.operatorId &&
          other.operatorName == this.operatorName &&
          other.profileId == this.profileId &&
          other.kind == this.kind &&
          other.envelope == this.envelope &&
          other.status == this.status &&
          other.attempts == this.attempts &&
          other.retryAt == this.retryAt &&
          other.lastError == this.lastError &&
          other.acknowledgment == this.acknowledgment &&
          other.recoveryOwnerId == this.recoveryOwnerId &&
          other.recoveryReason == this.recoveryReason);
}

class StoreOperatingEventsCompanion
    extends UpdateCompanion<StoreOperatingEvent> {
  final Value<String> epoch;
  final Value<int> sequence;
  final Value<String> commandId;
  final Value<String> resourceId;
  final Value<String> operatorId;
  final Value<String?> operatorName;
  final Value<String?> profileId;
  final Value<String> kind;
  final Value<String> envelope;
  final Value<String> status;
  final Value<int> attempts;
  final Value<DateTime> retryAt;
  final Value<String?> lastError;
  final Value<String?> acknowledgment;
  final Value<String?> recoveryOwnerId;
  final Value<String?> recoveryReason;
  final Value<int> rowid;
  const StoreOperatingEventsCompanion({
    this.epoch = const Value.absent(),
    this.sequence = const Value.absent(),
    this.commandId = const Value.absent(),
    this.resourceId = const Value.absent(),
    this.operatorId = const Value.absent(),
    this.operatorName = const Value.absent(),
    this.profileId = const Value.absent(),
    this.kind = const Value.absent(),
    this.envelope = const Value.absent(),
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    this.retryAt = const Value.absent(),
    this.lastError = const Value.absent(),
    this.acknowledgment = const Value.absent(),
    this.recoveryOwnerId = const Value.absent(),
    this.recoveryReason = const Value.absent(),
    this.rowid = const Value.absent(),
  });
  StoreOperatingEventsCompanion.insert({
    required String epoch,
    required int sequence,
    required String commandId,
    required String resourceId,
    required String operatorId,
    this.operatorName = const Value.absent(),
    this.profileId = const Value.absent(),
    required String kind,
    required String envelope,
    this.status = const Value.absent(),
    this.attempts = const Value.absent(),
    required DateTime retryAt,
    this.lastError = const Value.absent(),
    this.acknowledgment = const Value.absent(),
    this.recoveryOwnerId = const Value.absent(),
    this.recoveryReason = const Value.absent(),
    this.rowid = const Value.absent(),
  }) : epoch = Value(epoch),
       sequence = Value(sequence),
       commandId = Value(commandId),
       resourceId = Value(resourceId),
       operatorId = Value(operatorId),
       kind = Value(kind),
       envelope = Value(envelope),
       retryAt = Value(retryAt);
  static Insertable<StoreOperatingEvent> custom({
    Expression<String>? epoch,
    Expression<int>? sequence,
    Expression<String>? commandId,
    Expression<String>? resourceId,
    Expression<String>? operatorId,
    Expression<String>? operatorName,
    Expression<String>? profileId,
    Expression<String>? kind,
    Expression<String>? envelope,
    Expression<String>? status,
    Expression<int>? attempts,
    Expression<DateTime>? retryAt,
    Expression<String>? lastError,
    Expression<String>? acknowledgment,
    Expression<String>? recoveryOwnerId,
    Expression<String>? recoveryReason,
    Expression<int>? rowid,
  }) {
    return RawValuesInsertable({
      if (epoch != null) 'epoch': epoch,
      if (sequence != null) 'sequence': sequence,
      if (commandId != null) 'command_id': commandId,
      if (resourceId != null) 'resource_id': resourceId,
      if (operatorId != null) 'operator_id': operatorId,
      if (operatorName != null) 'operator_name': operatorName,
      if (profileId != null) 'profile_id': profileId,
      if (kind != null) 'kind': kind,
      if (envelope != null) 'envelope': envelope,
      if (status != null) 'status': status,
      if (attempts != null) 'attempts': attempts,
      if (retryAt != null) 'retry_at': retryAt,
      if (lastError != null) 'last_error': lastError,
      if (acknowledgment != null) 'acknowledgment': acknowledgment,
      if (recoveryOwnerId != null) 'recovery_owner_id': recoveryOwnerId,
      if (recoveryReason != null) 'recovery_reason': recoveryReason,
      if (rowid != null) 'rowid': rowid,
    });
  }

  StoreOperatingEventsCompanion copyWith({
    Value<String>? epoch,
    Value<int>? sequence,
    Value<String>? commandId,
    Value<String>? resourceId,
    Value<String>? operatorId,
    Value<String?>? operatorName,
    Value<String?>? profileId,
    Value<String>? kind,
    Value<String>? envelope,
    Value<String>? status,
    Value<int>? attempts,
    Value<DateTime>? retryAt,
    Value<String?>? lastError,
    Value<String?>? acknowledgment,
    Value<String?>? recoveryOwnerId,
    Value<String?>? recoveryReason,
    Value<int>? rowid,
  }) {
    return StoreOperatingEventsCompanion(
      epoch: epoch ?? this.epoch,
      sequence: sequence ?? this.sequence,
      commandId: commandId ?? this.commandId,
      resourceId: resourceId ?? this.resourceId,
      operatorId: operatorId ?? this.operatorId,
      operatorName: operatorName ?? this.operatorName,
      profileId: profileId ?? this.profileId,
      kind: kind ?? this.kind,
      envelope: envelope ?? this.envelope,
      status: status ?? this.status,
      attempts: attempts ?? this.attempts,
      retryAt: retryAt ?? this.retryAt,
      lastError: lastError ?? this.lastError,
      acknowledgment: acknowledgment ?? this.acknowledgment,
      recoveryOwnerId: recoveryOwnerId ?? this.recoveryOwnerId,
      recoveryReason: recoveryReason ?? this.recoveryReason,
      rowid: rowid ?? this.rowid,
    );
  }

  @override
  Map<String, Expression> toColumns(bool nullToAbsent) {
    final map = <String, Expression>{};
    if (epoch.present) {
      map['epoch'] = Variable<String>(epoch.value);
    }
    if (sequence.present) {
      map['sequence'] = Variable<int>(sequence.value);
    }
    if (commandId.present) {
      map['command_id'] = Variable<String>(commandId.value);
    }
    if (resourceId.present) {
      map['resource_id'] = Variable<String>(resourceId.value);
    }
    if (operatorId.present) {
      map['operator_id'] = Variable<String>(operatorId.value);
    }
    if (operatorName.present) {
      map['operator_name'] = Variable<String>(operatorName.value);
    }
    if (profileId.present) {
      map['profile_id'] = Variable<String>(profileId.value);
    }
    if (kind.present) {
      map['kind'] = Variable<String>(kind.value);
    }
    if (envelope.present) {
      map['envelope'] = Variable<String>(envelope.value);
    }
    if (status.present) {
      map['status'] = Variable<String>(status.value);
    }
    if (attempts.present) {
      map['attempts'] = Variable<int>(attempts.value);
    }
    if (retryAt.present) {
      map['retry_at'] = Variable<DateTime>(retryAt.value);
    }
    if (lastError.present) {
      map['last_error'] = Variable<String>(lastError.value);
    }
    if (acknowledgment.present) {
      map['acknowledgment'] = Variable<String>(acknowledgment.value);
    }
    if (recoveryOwnerId.present) {
      map['recovery_owner_id'] = Variable<String>(recoveryOwnerId.value);
    }
    if (recoveryReason.present) {
      map['recovery_reason'] = Variable<String>(recoveryReason.value);
    }
    if (rowid.present) {
      map['rowid'] = Variable<int>(rowid.value);
    }
    return map;
  }

  @override
  String toString() {
    return (StringBuffer('StoreOperatingEventsCompanion(')
          ..write('epoch: $epoch, ')
          ..write('sequence: $sequence, ')
          ..write('commandId: $commandId, ')
          ..write('resourceId: $resourceId, ')
          ..write('operatorId: $operatorId, ')
          ..write('operatorName: $operatorName, ')
          ..write('profileId: $profileId, ')
          ..write('kind: $kind, ')
          ..write('envelope: $envelope, ')
          ..write('status: $status, ')
          ..write('attempts: $attempts, ')
          ..write('retryAt: $retryAt, ')
          ..write('lastError: $lastError, ')
          ..write('acknowledgment: $acknowledgment, ')
          ..write('recoveryOwnerId: $recoveryOwnerId, ')
          ..write('recoveryReason: $recoveryReason, ')
          ..write('rowid: $rowid')
          ..write(')'))
        .toString();
  }
}

abstract class _$RegisterDatabase extends GeneratedDatabase {
  _$RegisterDatabase(QueryExecutor e) : super(e);
  $RegisterDatabaseManager get managers => $RegisterDatabaseManager(this);
  late final $RegisterInstallationsTable registerInstallations =
      $RegisterInstallationsTable(this);
  late final $RegisterOperatorsTable registerOperators =
      $RegisterOperatorsTable(this);
  late final $ProfileSnapshotsTable profileSnapshots = $ProfileSnapshotsTable(
    this,
  );
  late final $LocalSalesTable localSales = $LocalSalesTable(this);
  late final $SaleOutboxTable saleOutbox = $SaleOutboxTable(this);
  late final $HeldBillsTable heldBills = $HeldBillsTable(this);
  late final $RegisterCartDraftsTable registerCartDrafts =
      $RegisterCartDraftsTable(this);
  late final $RegisterCommandsTable registerCommands = $RegisterCommandsTable(
    this,
  );
  late final $StoreNetworkSettingsTable storeNetworkSettings =
      $StoreNetworkSettingsTable(this);
  late final $StoreDevicesTable storeDevices = $StoreDevicesTable(this);
  late final $StoreStaffGrantsTable storeStaffGrants = $StoreStaffGrantsTable(
    this,
  );
  late final $TillCommandsTable tillCommands = $TillCommandsTable(this);
  late final $ReceiptPrintsTable receiptPrints = $ReceiptPrintsTable(this);
  late final $StoreOperatingStatesTable storeOperatingStates =
      $StoreOperatingStatesTable(this);
  late final $StoreOperatingEventsTable storeOperatingEvents =
      $StoreOperatingEventsTable(this);
  late final Index localSalesOneReversal = Index(
    'local_sales_one_reversal',
    'CREATE UNIQUE INDEX local_sales_one_reversal ON local_sales (reverses_sale_id)',
  );
  late final Index saleOutboxPending = Index(
    'sale_outbox_pending',
    'CREATE INDEX sale_outbox_pending ON sale_outbox (status, retry_at)',
  );
  @override
  Iterable<TableInfo<Table, Object?>> get allTables =>
      allSchemaEntities.whereType<TableInfo<Table, Object?>>();
  @override
  List<DatabaseSchemaEntity> get allSchemaEntities => [
    registerInstallations,
    registerOperators,
    profileSnapshots,
    localSales,
    saleOutbox,
    heldBills,
    registerCartDrafts,
    registerCommands,
    storeNetworkSettings,
    storeDevices,
    storeStaffGrants,
    tillCommands,
    receiptPrints,
    storeOperatingStates,
    storeOperatingEvents,
    localSalesOneReversal,
    saleOutboxPending,
  ];
}

typedef $$RegisterInstallationsTableCreateCompanionBuilder =
    RegisterInstallationsCompanion Function({
      Value<int> id,
      required String apiOrigin,
      required String businessSlug,
      required String businessId,
      required String branchId,
      required String profileId,
    });
typedef $$RegisterInstallationsTableUpdateCompanionBuilder =
    RegisterInstallationsCompanion Function({
      Value<int> id,
      Value<String> apiOrigin,
      Value<String> businessSlug,
      Value<String> businessId,
      Value<String> branchId,
      Value<String> profileId,
    });

class $$RegisterInstallationsTableFilterComposer
    extends Composer<_$RegisterDatabase, $RegisterInstallationsTable> {
  $$RegisterInstallationsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get apiOrigin => $composableBuilder(
    column: $table.apiOrigin,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get businessSlug => $composableBuilder(
    column: $table.businessSlug,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnFilters(column),
  );
}

class $$RegisterInstallationsTableOrderingComposer
    extends Composer<_$RegisterDatabase, $RegisterInstallationsTable> {
  $$RegisterInstallationsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get apiOrigin => $composableBuilder(
    column: $table.apiOrigin,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get businessSlug => $composableBuilder(
    column: $table.businessSlug,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get branchId => $composableBuilder(
    column: $table.branchId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$RegisterInstallationsTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $RegisterInstallationsTable> {
  $$RegisterInstallationsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get apiOrigin =>
      $composableBuilder(column: $table.apiOrigin, builder: (column) => column);

  GeneratedColumn<String> get businessSlug => $composableBuilder(
    column: $table.businessSlug,
    builder: (column) => column,
  );

  GeneratedColumn<String> get businessId => $composableBuilder(
    column: $table.businessId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get branchId =>
      $composableBuilder(column: $table.branchId, builder: (column) => column);

  GeneratedColumn<String> get profileId =>
      $composableBuilder(column: $table.profileId, builder: (column) => column);
}

class $$RegisterInstallationsTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $RegisterInstallationsTable,
          RegisterInstallation,
          $$RegisterInstallationsTableFilterComposer,
          $$RegisterInstallationsTableOrderingComposer,
          $$RegisterInstallationsTableAnnotationComposer,
          $$RegisterInstallationsTableCreateCompanionBuilder,
          $$RegisterInstallationsTableUpdateCompanionBuilder,
          (
            RegisterInstallation,
            BaseReferences<
              _$RegisterDatabase,
              $RegisterInstallationsTable,
              RegisterInstallation
            >,
          ),
          RegisterInstallation,
          PrefetchHooks Function()
        > {
  $$RegisterInstallationsTableTableManager(
    _$RegisterDatabase db,
    $RegisterInstallationsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$RegisterInstallationsTableFilterComposer(
                $db: db,
                $table: table,
              ),
          createOrderingComposer: () =>
              $$RegisterInstallationsTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$RegisterInstallationsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> apiOrigin = const Value.absent(),
                Value<String> businessSlug = const Value.absent(),
                Value<String> businessId = const Value.absent(),
                Value<String> branchId = const Value.absent(),
                Value<String> profileId = const Value.absent(),
              }) => RegisterInstallationsCompanion(
                id: id,
                apiOrigin: apiOrigin,
                businessSlug: businessSlug,
                businessId: businessId,
                branchId: branchId,
                profileId: profileId,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String apiOrigin,
                required String businessSlug,
                required String businessId,
                required String branchId,
                required String profileId,
              }) => RegisterInstallationsCompanion.insert(
                id: id,
                apiOrigin: apiOrigin,
                businessSlug: businessSlug,
                businessId: businessId,
                branchId: branchId,
                profileId: profileId,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<
                    $RegisterInstallationsTable,
                    RegisterInstallation
                  >(table),
                  BaseReferences<
                    _$RegisterDatabase,
                    $RegisterInstallationsTable,
                    RegisterInstallation
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$RegisterInstallationsTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $RegisterInstallationsTable,
      RegisterInstallation,
      $$RegisterInstallationsTableFilterComposer,
      $$RegisterInstallationsTableOrderingComposer,
      $$RegisterInstallationsTableAnnotationComposer,
      $$RegisterInstallationsTableCreateCompanionBuilder,
      $$RegisterInstallationsTableUpdateCompanionBuilder,
      (
        RegisterInstallation,
        BaseReferences<
          _$RegisterDatabase,
          $RegisterInstallationsTable,
          RegisterInstallation
        >,
      ),
      RegisterInstallation,
      PrefetchHooks Function()
    >;
typedef $$RegisterOperatorsTableCreateCompanionBuilder =
    RegisterOperatorsCompanion Function({
      required String id,
      required String email,
      required String displayName,
      required String role,
      Value<int> failedPins,
      Value<DateTime?> blockedUntil,
      Value<bool> accessRevoked,
      Value<int> rowid,
    });
typedef $$RegisterOperatorsTableUpdateCompanionBuilder =
    RegisterOperatorsCompanion Function({
      Value<String> id,
      Value<String> email,
      Value<String> displayName,
      Value<String> role,
      Value<int> failedPins,
      Value<DateTime?> blockedUntil,
      Value<bool> accessRevoked,
      Value<int> rowid,
    });

final class $$RegisterOperatorsTableReferences
    extends
        BaseReferences<
          _$RegisterDatabase,
          $RegisterOperatorsTable,
          RegisterOperator
        > {
  $$RegisterOperatorsTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static MultiTypedResultKey<$RegisterCartDraftsTable, List<RegisterCartDraft>>
  _registerCartDraftsRefsTable(_$RegisterDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.registerCartDrafts,
        aliasName: 'register_operators__id__register_cart_drafts__operator_id',
      );

  $$RegisterCartDraftsTableProcessedTableManager get registerCartDraftsRefs {
    final manager = $$RegisterCartDraftsTableTableManager(
      $_db,
      $_db.registerCartDrafts,
    ).filter((f) => f.operatorId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _registerCartDraftsRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$RegisterOperatorsTableFilterComposer
    extends Composer<_$RegisterDatabase, $RegisterOperatorsTable> {
  $$RegisterOperatorsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get email => $composableBuilder(
    column: $table.email,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get displayName => $composableBuilder(
    column: $table.displayName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get role => $composableBuilder(
    column: $table.role,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get failedPins => $composableBuilder(
    column: $table.failedPins,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get blockedUntil => $composableBuilder(
    column: $table.blockedUntil,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<bool> get accessRevoked => $composableBuilder(
    column: $table.accessRevoked,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> registerCartDraftsRefs(
    Expression<bool> Function($$RegisterCartDraftsTableFilterComposer f) f,
  ) {
    final $$RegisterCartDraftsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.registerCartDrafts,
      getReferencedColumn: (t) => t.operatorId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$RegisterCartDraftsTableFilterComposer(
            $db: $db,
            $table: $db.registerCartDrafts,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$RegisterOperatorsTableOrderingComposer
    extends Composer<_$RegisterDatabase, $RegisterOperatorsTable> {
  $$RegisterOperatorsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get email => $composableBuilder(
    column: $table.email,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get displayName => $composableBuilder(
    column: $table.displayName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get role => $composableBuilder(
    column: $table.role,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get failedPins => $composableBuilder(
    column: $table.failedPins,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get blockedUntil => $composableBuilder(
    column: $table.blockedUntil,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<bool> get accessRevoked => $composableBuilder(
    column: $table.accessRevoked,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$RegisterOperatorsTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $RegisterOperatorsTable> {
  $$RegisterOperatorsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get email =>
      $composableBuilder(column: $table.email, builder: (column) => column);

  GeneratedColumn<String> get displayName => $composableBuilder(
    column: $table.displayName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get role =>
      $composableBuilder(column: $table.role, builder: (column) => column);

  GeneratedColumn<int> get failedPins => $composableBuilder(
    column: $table.failedPins,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get blockedUntil => $composableBuilder(
    column: $table.blockedUntil,
    builder: (column) => column,
  );

  GeneratedColumn<bool> get accessRevoked => $composableBuilder(
    column: $table.accessRevoked,
    builder: (column) => column,
  );

  Expression<T> registerCartDraftsRefs<T extends Object>(
    Expression<T> Function($$RegisterCartDraftsTableAnnotationComposer a) f,
  ) {
    final $$RegisterCartDraftsTableAnnotationComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.id,
          referencedTable: $db.registerCartDrafts,
          getReferencedColumn: (t) => t.operatorId,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$RegisterCartDraftsTableAnnotationComposer(
                $db: $db,
                $table: $db.registerCartDrafts,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return f(composer);
  }
}

class $$RegisterOperatorsTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $RegisterOperatorsTable,
          RegisterOperator,
          $$RegisterOperatorsTableFilterComposer,
          $$RegisterOperatorsTableOrderingComposer,
          $$RegisterOperatorsTableAnnotationComposer,
          $$RegisterOperatorsTableCreateCompanionBuilder,
          $$RegisterOperatorsTableUpdateCompanionBuilder,
          (RegisterOperator, $$RegisterOperatorsTableReferences),
          RegisterOperator,
          PrefetchHooks Function({bool registerCartDraftsRefs})
        > {
  $$RegisterOperatorsTableTableManager(
    _$RegisterDatabase db,
    $RegisterOperatorsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$RegisterOperatorsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$RegisterOperatorsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$RegisterOperatorsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> email = const Value.absent(),
                Value<String> displayName = const Value.absent(),
                Value<String> role = const Value.absent(),
                Value<int> failedPins = const Value.absent(),
                Value<DateTime?> blockedUntil = const Value.absent(),
                Value<bool> accessRevoked = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RegisterOperatorsCompanion(
                id: id,
                email: email,
                displayName: displayName,
                role: role,
                failedPins: failedPins,
                blockedUntil: blockedUntil,
                accessRevoked: accessRevoked,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String email,
                required String displayName,
                required String role,
                Value<int> failedPins = const Value.absent(),
                Value<DateTime?> blockedUntil = const Value.absent(),
                Value<bool> accessRevoked = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RegisterOperatorsCompanion.insert(
                id: id,
                email: email,
                displayName: displayName,
                role: role,
                failedPins: failedPins,
                blockedUntil: blockedUntil,
                accessRevoked: accessRevoked,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$RegisterOperatorsTable, RegisterOperator>(table),
                  $$RegisterOperatorsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({registerCartDraftsRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [
                if (registerCartDraftsRefs) db.registerCartDrafts,
              ],
              addJoins: null,
              getPrefetchedDataCallback: (items) async {
                return [
                  if (registerCartDraftsRefs)
                    await $_getPrefetchedDataByColumns<
                      RegisterOperator,
                      $RegisterOperatorsTable,
                      RegisterCartDraft,
                      $RegisterCartDraftsTable
                    >(
                      currentTable: table,
                      referencedTable: $$RegisterOperatorsTableReferences
                          ._registerCartDraftsRefsTable(db),
                      managerFromTypedResult: (p0) =>
                          $$RegisterOperatorsTableReferences(
                            db,
                            table,
                            p0,
                          ).registerCartDraftsRefs,
                      currentColumn: 'id',
                      referencedColumn: 'operator_id',
                      typedResults: items,
                    ),
                ];
              },
            );
          },
        ),
      );
}

typedef $$RegisterOperatorsTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $RegisterOperatorsTable,
      RegisterOperator,
      $$RegisterOperatorsTableFilterComposer,
      $$RegisterOperatorsTableOrderingComposer,
      $$RegisterOperatorsTableAnnotationComposer,
      $$RegisterOperatorsTableCreateCompanionBuilder,
      $$RegisterOperatorsTableUpdateCompanionBuilder,
      (RegisterOperator, $$RegisterOperatorsTableReferences),
      RegisterOperator,
      PrefetchHooks Function({bool registerCartDraftsRefs})
    >;
typedef $$ProfileSnapshotsTableCreateCompanionBuilder =
    ProfileSnapshotsCompanion Function({
      required String profileId,
      required String payload,
      required DateTime refreshedAt,
      Value<int> rowid,
    });
typedef $$ProfileSnapshotsTableUpdateCompanionBuilder =
    ProfileSnapshotsCompanion Function({
      Value<String> profileId,
      Value<String> payload,
      Value<DateTime> refreshedAt,
      Value<int> rowid,
    });

class $$ProfileSnapshotsTableFilterComposer
    extends Composer<_$RegisterDatabase, $ProfileSnapshotsTable> {
  $$ProfileSnapshotsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get refreshedAt => $composableBuilder(
    column: $table.refreshedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ProfileSnapshotsTableOrderingComposer
    extends Composer<_$RegisterDatabase, $ProfileSnapshotsTable> {
  $$ProfileSnapshotsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get refreshedAt => $composableBuilder(
    column: $table.refreshedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ProfileSnapshotsTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $ProfileSnapshotsTable> {
  $$ProfileSnapshotsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get profileId =>
      $composableBuilder(column: $table.profileId, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<DateTime> get refreshedAt => $composableBuilder(
    column: $table.refreshedAt,
    builder: (column) => column,
  );
}

class $$ProfileSnapshotsTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $ProfileSnapshotsTable,
          ProfileSnapshot,
          $$ProfileSnapshotsTableFilterComposer,
          $$ProfileSnapshotsTableOrderingComposer,
          $$ProfileSnapshotsTableAnnotationComposer,
          $$ProfileSnapshotsTableCreateCompanionBuilder,
          $$ProfileSnapshotsTableUpdateCompanionBuilder,
          (
            ProfileSnapshot,
            BaseReferences<
              _$RegisterDatabase,
              $ProfileSnapshotsTable,
              ProfileSnapshot
            >,
          ),
          ProfileSnapshot,
          PrefetchHooks Function()
        > {
  $$ProfileSnapshotsTableTableManager(
    _$RegisterDatabase db,
    $ProfileSnapshotsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ProfileSnapshotsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ProfileSnapshotsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ProfileSnapshotsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> profileId = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<DateTime> refreshedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => ProfileSnapshotsCompanion(
                profileId: profileId,
                payload: payload,
                refreshedAt: refreshedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String profileId,
                required String payload,
                required DateTime refreshedAt,
                Value<int> rowid = const Value.absent(),
              }) => ProfileSnapshotsCompanion.insert(
                profileId: profileId,
                payload: payload,
                refreshedAt: refreshedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$ProfileSnapshotsTable, ProfileSnapshot>(table),
                  BaseReferences<
                    _$RegisterDatabase,
                    $ProfileSnapshotsTable,
                    ProfileSnapshot
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ProfileSnapshotsTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $ProfileSnapshotsTable,
      ProfileSnapshot,
      $$ProfileSnapshotsTableFilterComposer,
      $$ProfileSnapshotsTableOrderingComposer,
      $$ProfileSnapshotsTableAnnotationComposer,
      $$ProfileSnapshotsTableCreateCompanionBuilder,
      $$ProfileSnapshotsTableUpdateCompanionBuilder,
      (
        ProfileSnapshot,
        BaseReferences<
          _$RegisterDatabase,
          $ProfileSnapshotsTable,
          ProfileSnapshot
        >,
      ),
      ProfileSnapshot,
      PrefetchHooks Function()
    >;
typedef $$LocalSalesTableCreateCompanionBuilder = LocalSalesCompanion Function({
  required String id,
  required String profileId,
  required String operatorId,
  required DateTime createdAt,
  required int total,
  required String currency,
  required String request,
  Value<String?> settlement,
  Value<String?> reversesSaleId,
  Value<int> rowid,
});
typedef $$LocalSalesTableUpdateCompanionBuilder = LocalSalesCompanion Function({
  Value<String> id,
  Value<String> profileId,
  Value<String> operatorId,
  Value<DateTime> createdAt,
  Value<int> total,
  Value<String> currency,
  Value<String> request,
  Value<String?> settlement,
  Value<String?> reversesSaleId,
  Value<int> rowid,
});

final class $$LocalSalesTableReferences
    extends BaseReferences<_$RegisterDatabase, $LocalSalesTable, LocalSale> {
  $$LocalSalesTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $LocalSalesTable _reversesSaleIdTable(_$RegisterDatabase db) => db
      .localSales
      .createAlias('local_sales__reverses_sale_id__local_sales__id');

  $$LocalSalesTableProcessedTableManager? get reversesSaleId {
    final $_column = $_itemColumn<String>('reverses_sale_id');
    if ($_column == null) return null;
    final manager = $$LocalSalesTableTableManager(
      $_db,
      $_db.localSales,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_reversesSaleIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }

  static MultiTypedResultKey<$SaleOutboxTable, List<SaleOutboxData>>
  _saleOutboxRefsTable(_$RegisterDatabase db) => MultiTypedResultKey.fromTable(
    db.saleOutbox,
    aliasName: 'local_sales__id__sale_outbox__sale_id',
  );

  $$SaleOutboxTableProcessedTableManager get saleOutboxRefs {
    final manager = $$SaleOutboxTableTableManager(
      $_db,
      $_db.saleOutbox,
    ).filter((f) => f.saleId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(_saleOutboxRefsTable($_db));
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$LocalSalesTableFilterComposer
    extends Composer<_$RegisterDatabase, $LocalSalesTable> {
  $$LocalSalesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get total => $composableBuilder(
    column: $table.total,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get currency => $composableBuilder(
    column: $table.currency,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get request => $composableBuilder(
    column: $table.request,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get settlement => $composableBuilder(
    column: $table.settlement,
    builder: (column) => ColumnFilters(column),
  );

  $$LocalSalesTableFilterComposer get reversesSaleId {
    final $$LocalSalesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.reversesSaleId,
      referencedTable: $db.localSales,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$LocalSalesTableFilterComposer(
            $db: $db,
            $table: $db.localSales,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  Expression<bool> saleOutboxRefs(
    Expression<bool> Function($$SaleOutboxTableFilterComposer f) f,
  ) {
    final $$SaleOutboxTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.saleOutbox,
      getReferencedColumn: (t) => t.saleId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SaleOutboxTableFilterComposer(
            $db: $db,
            $table: $db.saleOutbox,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$LocalSalesTableOrderingComposer
    extends Composer<_$RegisterDatabase, $LocalSalesTable> {
  $$LocalSalesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get total => $composableBuilder(
    column: $table.total,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get currency => $composableBuilder(
    column: $table.currency,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get request => $composableBuilder(
    column: $table.request,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get settlement => $composableBuilder(
    column: $table.settlement,
    builder: (column) => ColumnOrderings(column),
  );

  $$LocalSalesTableOrderingComposer get reversesSaleId {
    final $$LocalSalesTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.reversesSaleId,
      referencedTable: $db.localSales,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$LocalSalesTableOrderingComposer(
            $db: $db,
            $table: $db.localSales,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$LocalSalesTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $LocalSalesTable> {
  $$LocalSalesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get profileId =>
      $composableBuilder(column: $table.profileId, builder: (column) => column);

  GeneratedColumn<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);

  GeneratedColumn<int> get total =>
      $composableBuilder(column: $table.total, builder: (column) => column);

  GeneratedColumn<String> get currency =>
      $composableBuilder(column: $table.currency, builder: (column) => column);

  GeneratedColumn<String> get request =>
      $composableBuilder(column: $table.request, builder: (column) => column);

  GeneratedColumn<String> get settlement => $composableBuilder(
    column: $table.settlement,
    builder: (column) => column,
  );

  $$LocalSalesTableAnnotationComposer get reversesSaleId {
    final $$LocalSalesTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.reversesSaleId,
      referencedTable: $db.localSales,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$LocalSalesTableAnnotationComposer(
            $db: $db,
            $table: $db.localSales,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }

  Expression<T> saleOutboxRefs<T extends Object>(
    Expression<T> Function($$SaleOutboxTableAnnotationComposer a) f,
  ) {
    final $$SaleOutboxTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.saleOutbox,
      getReferencedColumn: (t) => t.saleId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$SaleOutboxTableAnnotationComposer(
            $db: $db,
            $table: $db.saleOutbox,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$LocalSalesTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $LocalSalesTable,
          LocalSale,
          $$LocalSalesTableFilterComposer,
          $$LocalSalesTableOrderingComposer,
          $$LocalSalesTableAnnotationComposer,
          $$LocalSalesTableCreateCompanionBuilder,
          $$LocalSalesTableUpdateCompanionBuilder,
          (LocalSale, $$LocalSalesTableReferences),
          LocalSale,
          PrefetchHooks Function({bool reversesSaleId, bool saleOutboxRefs})
        > {
  $$LocalSalesTableTableManager(_$RegisterDatabase db, $LocalSalesTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$LocalSalesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$LocalSalesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$LocalSalesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> profileId = const Value.absent(),
                Value<String> operatorId = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> total = const Value.absent(),
                Value<String> currency = const Value.absent(),
                Value<String> request = const Value.absent(),
                Value<String?> settlement = const Value.absent(),
                Value<String?> reversesSaleId = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalSalesCompanion(
                id: id,
                profileId: profileId,
                operatorId: operatorId,
                createdAt: createdAt,
                total: total,
                currency: currency,
                request: request,
                settlement: settlement,
                reversesSaleId: reversesSaleId,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String profileId,
                required String operatorId,
                required DateTime createdAt,
                required int total,
                required String currency,
                required String request,
                Value<String?> settlement = const Value.absent(),
                Value<String?> reversesSaleId = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => LocalSalesCompanion.insert(
                id: id,
                profileId: profileId,
                operatorId: operatorId,
                createdAt: createdAt,
                total: total,
                currency: currency,
                request: request,
                settlement: settlement,
                reversesSaleId: reversesSaleId,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$LocalSalesTable, LocalSale>(table),
                  $$LocalSalesTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback:
              ({reversesSaleId = false, saleOutboxRefs = false}) {
                return PrefetchHooks(
                  db: db,
                  explicitlyWatchedTables: [if (saleOutboxRefs) db.saleOutbox],
                  addJoins:
                      <
                        T extends TableManagerState<
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic,
                          dynamic
                        >
                      >(state) {
                        if (reversesSaleId) {
                          state = state.withJoin(
                            currentTable: table,
                            currentColumn: table.reversesSaleId,
                            referencedTable: $$LocalSalesTableReferences
                                ._reversesSaleIdTable(db),
                            referencedColumn: $$LocalSalesTableReferences
                                ._reversesSaleIdTable(db)
                                .id,
                          ) as T;
                        }

                        return state;
                      },
                  getPrefetchedDataCallback: (items) async {
                    return [
                      if (saleOutboxRefs)
                        await $_getPrefetchedDataByColumns<
                          LocalSale,
                          $LocalSalesTable,
                          SaleOutboxData,
                          $SaleOutboxTable
                        >(
                          currentTable: table,
                          referencedTable: $$LocalSalesTableReferences
                              ._saleOutboxRefsTable(db),
                          managerFromTypedResult: (p0) =>
                              $$LocalSalesTableReferences(
                                db,
                                table,
                                p0,
                              ).saleOutboxRefs,
                          currentColumn: 'id',
                          referencedColumn: 'sale_id',
                          typedResults: items,
                        ),
                    ];
                  },
                );
              },
        ),
      );
}

typedef $$LocalSalesTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $LocalSalesTable,
      LocalSale,
      $$LocalSalesTableFilterComposer,
      $$LocalSalesTableOrderingComposer,
      $$LocalSalesTableAnnotationComposer,
      $$LocalSalesTableCreateCompanionBuilder,
      $$LocalSalesTableUpdateCompanionBuilder,
      (LocalSale, $$LocalSalesTableReferences),
      LocalSale,
      PrefetchHooks Function({bool reversesSaleId, bool saleOutboxRefs})
    >;
typedef $$SaleOutboxTableCreateCompanionBuilder = SaleOutboxCompanion Function({
  Value<int> sequence,
  required String saleId,
  Value<String> status,
  Value<int> attempts,
  required DateTime retryAt,
  Value<String?> serverDraft,
  Value<String?> lastError,
});
typedef $$SaleOutboxTableUpdateCompanionBuilder = SaleOutboxCompanion Function({
  Value<int> sequence,
  Value<String> saleId,
  Value<String> status,
  Value<int> attempts,
  Value<DateTime> retryAt,
  Value<String?> serverDraft,
  Value<String?> lastError,
});

final class $$SaleOutboxTableReferences
    extends
        BaseReferences<_$RegisterDatabase, $SaleOutboxTable, SaleOutboxData> {
  $$SaleOutboxTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static $LocalSalesTable _saleIdTable(_$RegisterDatabase db) =>
      db.localSales.createAlias('sale_outbox__sale_id__local_sales__id');

  $$LocalSalesTableProcessedTableManager get saleId {
    final $_column = $_itemColumn<String>('sale_id')!;

    final manager = $$LocalSalesTableTableManager(
      $_db,
      $_db.localSales,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_saleIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$SaleOutboxTableFilterComposer
    extends Composer<_$RegisterDatabase, $SaleOutboxTable> {
  $$SaleOutboxTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get sequence => $composableBuilder(
    column: $table.sequence,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get retryAt => $composableBuilder(
    column: $table.retryAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get serverDraft => $composableBuilder(
    column: $table.serverDraft,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnFilters(column),
  );

  $$LocalSalesTableFilterComposer get saleId {
    final $$LocalSalesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.saleId,
      referencedTable: $db.localSales,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$LocalSalesTableFilterComposer(
            $db: $db,
            $table: $db.localSales,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$SaleOutboxTableOrderingComposer
    extends Composer<_$RegisterDatabase, $SaleOutboxTable> {
  $$SaleOutboxTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get sequence => $composableBuilder(
    column: $table.sequence,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get retryAt => $composableBuilder(
    column: $table.retryAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get serverDraft => $composableBuilder(
    column: $table.serverDraft,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnOrderings(column),
  );

  $$LocalSalesTableOrderingComposer get saleId {
    final $$LocalSalesTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.saleId,
      referencedTable: $db.localSales,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$LocalSalesTableOrderingComposer(
            $db: $db,
            $table: $db.localSales,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$SaleOutboxTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $SaleOutboxTable> {
  $$SaleOutboxTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get sequence =>
      $composableBuilder(column: $table.sequence, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);

  GeneratedColumn<DateTime> get retryAt =>
      $composableBuilder(column: $table.retryAt, builder: (column) => column);

  GeneratedColumn<String> get serverDraft => $composableBuilder(
    column: $table.serverDraft,
    builder: (column) => column,
  );

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);

  $$LocalSalesTableAnnotationComposer get saleId {
    final $$LocalSalesTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.saleId,
      referencedTable: $db.localSales,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$LocalSalesTableAnnotationComposer(
            $db: $db,
            $table: $db.localSales,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$SaleOutboxTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $SaleOutboxTable,
          SaleOutboxData,
          $$SaleOutboxTableFilterComposer,
          $$SaleOutboxTableOrderingComposer,
          $$SaleOutboxTableAnnotationComposer,
          $$SaleOutboxTableCreateCompanionBuilder,
          $$SaleOutboxTableUpdateCompanionBuilder,
          (SaleOutboxData, $$SaleOutboxTableReferences),
          SaleOutboxData,
          PrefetchHooks Function({bool saleId})
        > {
  $$SaleOutboxTableTableManager(_$RegisterDatabase db, $SaleOutboxTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$SaleOutboxTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$SaleOutboxTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$SaleOutboxTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> sequence = const Value.absent(),
                Value<String> saleId = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<DateTime> retryAt = const Value.absent(),
                Value<String?> serverDraft = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
              }) => SaleOutboxCompanion(
                sequence: sequence,
                saleId: saleId,
                status: status,
                attempts: attempts,
                retryAt: retryAt,
                serverDraft: serverDraft,
                lastError: lastError,
              ),
          createCompanionCallback:
              ({
                Value<int> sequence = const Value.absent(),
                required String saleId,
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                required DateTime retryAt,
                Value<String?> serverDraft = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
              }) => SaleOutboxCompanion.insert(
                sequence: sequence,
                saleId: saleId,
                status: status,
                attempts: attempts,
                retryAt: retryAt,
                serverDraft: serverDraft,
                lastError: lastError,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$SaleOutboxTable, SaleOutboxData>(table),
                  $$SaleOutboxTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({saleId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (saleId) {
                      state = state.withJoin(
                        currentTable: table,
                        currentColumn: table.saleId,
                        referencedTable: $$SaleOutboxTableReferences
                            ._saleIdTable(db),
                        referencedColumn: $$SaleOutboxTableReferences
                            ._saleIdTable(db)
                            .id,
                      ) as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$SaleOutboxTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $SaleOutboxTable,
      SaleOutboxData,
      $$SaleOutboxTableFilterComposer,
      $$SaleOutboxTableOrderingComposer,
      $$SaleOutboxTableAnnotationComposer,
      $$SaleOutboxTableCreateCompanionBuilder,
      $$SaleOutboxTableUpdateCompanionBuilder,
      (SaleOutboxData, $$SaleOutboxTableReferences),
      SaleOutboxData,
      PrefetchHooks Function({bool saleId})
    >;
typedef $$HeldBillsTableCreateCompanionBuilder = HeldBillsCompanion Function({
  required String id,
  required String profileId,
  Value<String?> tableId,
  Value<String?> workingDayId,
  required String payload,
  Value<int> revision,
  required DateTime updatedAt,
  Value<int> rowid,
});
typedef $$HeldBillsTableUpdateCompanionBuilder = HeldBillsCompanion Function({
  Value<String> id,
  Value<String> profileId,
  Value<String?> tableId,
  Value<String?> workingDayId,
  Value<String> payload,
  Value<int> revision,
  Value<DateTime> updatedAt,
  Value<int> rowid,
});

class $$HeldBillsTableFilterComposer
    extends Composer<_$RegisterDatabase, $HeldBillsTable> {
  $$HeldBillsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get tableId => $composableBuilder(
    column: $table.tableId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get workingDayId => $composableBuilder(
    column: $table.workingDayId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get revision => $composableBuilder(
    column: $table.revision,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$HeldBillsTableOrderingComposer
    extends Composer<_$RegisterDatabase, $HeldBillsTable> {
  $$HeldBillsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get tableId => $composableBuilder(
    column: $table.tableId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get workingDayId => $composableBuilder(
    column: $table.workingDayId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get revision => $composableBuilder(
    column: $table.revision,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get updatedAt => $composableBuilder(
    column: $table.updatedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$HeldBillsTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $HeldBillsTable> {
  $$HeldBillsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get profileId =>
      $composableBuilder(column: $table.profileId, builder: (column) => column);

  GeneratedColumn<String> get tableId =>
      $composableBuilder(column: $table.tableId, builder: (column) => column);

  GeneratedColumn<String> get workingDayId => $composableBuilder(
    column: $table.workingDayId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  GeneratedColumn<int> get revision =>
      $composableBuilder(column: $table.revision, builder: (column) => column);

  GeneratedColumn<DateTime> get updatedAt =>
      $composableBuilder(column: $table.updatedAt, builder: (column) => column);
}

class $$HeldBillsTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $HeldBillsTable,
          HeldBill,
          $$HeldBillsTableFilterComposer,
          $$HeldBillsTableOrderingComposer,
          $$HeldBillsTableAnnotationComposer,
          $$HeldBillsTableCreateCompanionBuilder,
          $$HeldBillsTableUpdateCompanionBuilder,
          (
            HeldBill,
            BaseReferences<_$RegisterDatabase, $HeldBillsTable, HeldBill>,
          ),
          HeldBill,
          PrefetchHooks Function()
        > {
  $$HeldBillsTableTableManager(_$RegisterDatabase db, $HeldBillsTable table)
    : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$HeldBillsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$HeldBillsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$HeldBillsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> profileId = const Value.absent(),
                Value<String?> tableId = const Value.absent(),
                Value<String?> workingDayId = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<int> revision = const Value.absent(),
                Value<DateTime> updatedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => HeldBillsCompanion(
                id: id,
                profileId: profileId,
                tableId: tableId,
                workingDayId: workingDayId,
                payload: payload,
                revision: revision,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String profileId,
                Value<String?> tableId = const Value.absent(),
                Value<String?> workingDayId = const Value.absent(),
                required String payload,
                Value<int> revision = const Value.absent(),
                required DateTime updatedAt,
                Value<int> rowid = const Value.absent(),
              }) => HeldBillsCompanion.insert(
                id: id,
                profileId: profileId,
                tableId: tableId,
                workingDayId: workingDayId,
                payload: payload,
                revision: revision,
                updatedAt: updatedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$HeldBillsTable, HeldBill>(table),
                  BaseReferences<_$RegisterDatabase, $HeldBillsTable, HeldBill>(
                    db,
                    table,
                    e,
                  ),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$HeldBillsTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $HeldBillsTable,
      HeldBill,
      $$HeldBillsTableFilterComposer,
      $$HeldBillsTableOrderingComposer,
      $$HeldBillsTableAnnotationComposer,
      $$HeldBillsTableCreateCompanionBuilder,
      $$HeldBillsTableUpdateCompanionBuilder,
      (HeldBill, BaseReferences<_$RegisterDatabase, $HeldBillsTable, HeldBill>),
      HeldBill,
      PrefetchHooks Function()
    >;
typedef $$RegisterCartDraftsTableCreateCompanionBuilder =
    RegisterCartDraftsCompanion Function({
      required String operatorId,
      required String profileId,
      Value<String?> billId,
      required String payload,
      Value<int> rowid,
    });
typedef $$RegisterCartDraftsTableUpdateCompanionBuilder =
    RegisterCartDraftsCompanion Function({
      Value<String> operatorId,
      Value<String> profileId,
      Value<String?> billId,
      Value<String> payload,
      Value<int> rowid,
    });

final class $$RegisterCartDraftsTableReferences
    extends
        BaseReferences<
          _$RegisterDatabase,
          $RegisterCartDraftsTable,
          RegisterCartDraft
        > {
  $$RegisterCartDraftsTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $RegisterOperatorsTable _operatorIdTable(_$RegisterDatabase db) => db
      .registerOperators
      .createAlias('register_cart_drafts__operator_id__register_operators__id');

  $$RegisterOperatorsTableProcessedTableManager get operatorId {
    final $_column = $_itemColumn<String>('operator_id')!;

    final manager = $$RegisterOperatorsTableTableManager(
      $_db,
      $_db.registerOperators,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_operatorIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$RegisterCartDraftsTableFilterComposer
    extends Composer<_$RegisterDatabase, $RegisterCartDraftsTable> {
  $$RegisterCartDraftsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get billId => $composableBuilder(
    column: $table.billId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );

  $$RegisterOperatorsTableFilterComposer get operatorId {
    final $$RegisterOperatorsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.operatorId,
      referencedTable: $db.registerOperators,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$RegisterOperatorsTableFilterComposer(
            $db: $db,
            $table: $db.registerOperators,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$RegisterCartDraftsTableOrderingComposer
    extends Composer<_$RegisterDatabase, $RegisterCartDraftsTable> {
  $$RegisterCartDraftsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get billId => $composableBuilder(
    column: $table.billId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );

  $$RegisterOperatorsTableOrderingComposer get operatorId {
    final $$RegisterOperatorsTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.operatorId,
      referencedTable: $db.registerOperators,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$RegisterOperatorsTableOrderingComposer(
            $db: $db,
            $table: $db.registerOperators,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$RegisterCartDraftsTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $RegisterCartDraftsTable> {
  $$RegisterCartDraftsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get profileId =>
      $composableBuilder(column: $table.profileId, builder: (column) => column);

  GeneratedColumn<String> get billId =>
      $composableBuilder(column: $table.billId, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);

  $$RegisterOperatorsTableAnnotationComposer get operatorId {
    final $$RegisterOperatorsTableAnnotationComposer composer =
        $composerBuilder(
          composer: this,
          getCurrentColumn: (t) => t.operatorId,
          referencedTable: $db.registerOperators,
          getReferencedColumn: (t) => t.id,
          builder:
              (
                joinBuilder, {
                $addJoinBuilderToRootComposer,
                $removeJoinBuilderFromRootComposer,
              }) => $$RegisterOperatorsTableAnnotationComposer(
                $db: $db,
                $table: $db.registerOperators,
                $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
                joinBuilder: joinBuilder,
                $removeJoinBuilderFromRootComposer:
                    $removeJoinBuilderFromRootComposer,
              ),
        );
    return composer;
  }
}

class $$RegisterCartDraftsTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $RegisterCartDraftsTable,
          RegisterCartDraft,
          $$RegisterCartDraftsTableFilterComposer,
          $$RegisterCartDraftsTableOrderingComposer,
          $$RegisterCartDraftsTableAnnotationComposer,
          $$RegisterCartDraftsTableCreateCompanionBuilder,
          $$RegisterCartDraftsTableUpdateCompanionBuilder,
          (RegisterCartDraft, $$RegisterCartDraftsTableReferences),
          RegisterCartDraft,
          PrefetchHooks Function({bool operatorId})
        > {
  $$RegisterCartDraftsTableTableManager(
    _$RegisterDatabase db,
    $RegisterCartDraftsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$RegisterCartDraftsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$RegisterCartDraftsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$RegisterCartDraftsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> operatorId = const Value.absent(),
                Value<String> profileId = const Value.absent(),
                Value<String?> billId = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RegisterCartDraftsCompanion(
                operatorId: operatorId,
                profileId: profileId,
                billId: billId,
                payload: payload,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String operatorId,
                required String profileId,
                Value<String?> billId = const Value.absent(),
                required String payload,
                Value<int> rowid = const Value.absent(),
              }) => RegisterCartDraftsCompanion.insert(
                operatorId: operatorId,
                profileId: profileId,
                billId: billId,
                payload: payload,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$RegisterCartDraftsTable, RegisterCartDraft>(
                    table,
                  ),
                  $$RegisterCartDraftsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({operatorId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (operatorId) {
                      state = state.withJoin(
                        currentTable: table,
                        currentColumn: table.operatorId,
                        referencedTable: $$RegisterCartDraftsTableReferences
                            ._operatorIdTable(db),
                        referencedColumn: $$RegisterCartDraftsTableReferences
                            ._operatorIdTable(db)
                            .id,
                      ) as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$RegisterCartDraftsTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $RegisterCartDraftsTable,
      RegisterCartDraft,
      $$RegisterCartDraftsTableFilterComposer,
      $$RegisterCartDraftsTableOrderingComposer,
      $$RegisterCartDraftsTableAnnotationComposer,
      $$RegisterCartDraftsTableCreateCompanionBuilder,
      $$RegisterCartDraftsTableUpdateCompanionBuilder,
      (RegisterCartDraft, $$RegisterCartDraftsTableReferences),
      RegisterCartDraft,
      PrefetchHooks Function({bool operatorId})
    >;
typedef $$RegisterCommandsTableCreateCompanionBuilder =
    RegisterCommandsCompanion Function({
      required String id,
      required String operatorId,
      Value<String?> profileId,
      required String fingerprint,
      required String result,
      required DateTime createdAt,
      Value<int> rowid,
    });
typedef $$RegisterCommandsTableUpdateCompanionBuilder =
    RegisterCommandsCompanion Function({
      Value<String> id,
      Value<String> operatorId,
      Value<String?> profileId,
      Value<String> fingerprint,
      Value<String> result,
      Value<DateTime> createdAt,
      Value<int> rowid,
    });

class $$RegisterCommandsTableFilterComposer
    extends Composer<_$RegisterDatabase, $RegisterCommandsTable> {
  $$RegisterCommandsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get fingerprint => $composableBuilder(
    column: $table.fingerprint,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get result => $composableBuilder(
    column: $table.result,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$RegisterCommandsTableOrderingComposer
    extends Composer<_$RegisterDatabase, $RegisterCommandsTable> {
  $$RegisterCommandsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get fingerprint => $composableBuilder(
    column: $table.fingerprint,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get result => $composableBuilder(
    column: $table.result,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get createdAt => $composableBuilder(
    column: $table.createdAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$RegisterCommandsTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $RegisterCommandsTable> {
  $$RegisterCommandsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get profileId =>
      $composableBuilder(column: $table.profileId, builder: (column) => column);

  GeneratedColumn<String> get fingerprint => $composableBuilder(
    column: $table.fingerprint,
    builder: (column) => column,
  );

  GeneratedColumn<String> get result =>
      $composableBuilder(column: $table.result, builder: (column) => column);

  GeneratedColumn<DateTime> get createdAt =>
      $composableBuilder(column: $table.createdAt, builder: (column) => column);
}

class $$RegisterCommandsTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $RegisterCommandsTable,
          RegisterCommand,
          $$RegisterCommandsTableFilterComposer,
          $$RegisterCommandsTableOrderingComposer,
          $$RegisterCommandsTableAnnotationComposer,
          $$RegisterCommandsTableCreateCompanionBuilder,
          $$RegisterCommandsTableUpdateCompanionBuilder,
          (
            RegisterCommand,
            BaseReferences<
              _$RegisterDatabase,
              $RegisterCommandsTable,
              RegisterCommand
            >,
          ),
          RegisterCommand,
          PrefetchHooks Function()
        > {
  $$RegisterCommandsTableTableManager(
    _$RegisterDatabase db,
    $RegisterCommandsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$RegisterCommandsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$RegisterCommandsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$RegisterCommandsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String> operatorId = const Value.absent(),
                Value<String?> profileId = const Value.absent(),
                Value<String> fingerprint = const Value.absent(),
                Value<String> result = const Value.absent(),
                Value<DateTime> createdAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => RegisterCommandsCompanion(
                id: id,
                operatorId: operatorId,
                profileId: profileId,
                fingerprint: fingerprint,
                result: result,
                createdAt: createdAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                required String operatorId,
                Value<String?> profileId = const Value.absent(),
                required String fingerprint,
                required String result,
                required DateTime createdAt,
                Value<int> rowid = const Value.absent(),
              }) => RegisterCommandsCompanion.insert(
                id: id,
                operatorId: operatorId,
                profileId: profileId,
                fingerprint: fingerprint,
                result: result,
                createdAt: createdAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$RegisterCommandsTable, RegisterCommand>(table),
                  BaseReferences<
                    _$RegisterDatabase,
                    $RegisterCommandsTable,
                    RegisterCommand
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$RegisterCommandsTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $RegisterCommandsTable,
      RegisterCommand,
      $$RegisterCommandsTableFilterComposer,
      $$RegisterCommandsTableOrderingComposer,
      $$RegisterCommandsTableAnnotationComposer,
      $$RegisterCommandsTableCreateCompanionBuilder,
      $$RegisterCommandsTableUpdateCompanionBuilder,
      (
        RegisterCommand,
        BaseReferences<
          _$RegisterDatabase,
          $RegisterCommandsTable,
          RegisterCommand
        >,
      ),
      RegisterCommand,
      PrefetchHooks Function()
    >;
typedef $$StoreNetworkSettingsTableCreateCompanionBuilder =
    StoreNetworkSettingsCompanion Function({
      Value<int> id,
      required String mode,
      Value<String?> endpoint,
      Value<String?> fingerprint,
    });
typedef $$StoreNetworkSettingsTableUpdateCompanionBuilder =
    StoreNetworkSettingsCompanion Function({
      Value<int> id,
      Value<String> mode,
      Value<String?> endpoint,
      Value<String?> fingerprint,
    });

class $$StoreNetworkSettingsTableFilterComposer
    extends Composer<_$RegisterDatabase, $StoreNetworkSettingsTable> {
  $$StoreNetworkSettingsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get mode => $composableBuilder(
    column: $table.mode,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get endpoint => $composableBuilder(
    column: $table.endpoint,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get fingerprint => $composableBuilder(
    column: $table.fingerprint,
    builder: (column) => ColumnFilters(column),
  );
}

class $$StoreNetworkSettingsTableOrderingComposer
    extends Composer<_$RegisterDatabase, $StoreNetworkSettingsTable> {
  $$StoreNetworkSettingsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get mode => $composableBuilder(
    column: $table.mode,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get endpoint => $composableBuilder(
    column: $table.endpoint,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get fingerprint => $composableBuilder(
    column: $table.fingerprint,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$StoreNetworkSettingsTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $StoreNetworkSettingsTable> {
  $$StoreNetworkSettingsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get mode =>
      $composableBuilder(column: $table.mode, builder: (column) => column);

  GeneratedColumn<String> get endpoint =>
      $composableBuilder(column: $table.endpoint, builder: (column) => column);

  GeneratedColumn<String> get fingerprint => $composableBuilder(
    column: $table.fingerprint,
    builder: (column) => column,
  );
}

class $$StoreNetworkSettingsTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $StoreNetworkSettingsTable,
          StoreNetworkSetting,
          $$StoreNetworkSettingsTableFilterComposer,
          $$StoreNetworkSettingsTableOrderingComposer,
          $$StoreNetworkSettingsTableAnnotationComposer,
          $$StoreNetworkSettingsTableCreateCompanionBuilder,
          $$StoreNetworkSettingsTableUpdateCompanionBuilder,
          (
            StoreNetworkSetting,
            BaseReferences<
              _$RegisterDatabase,
              $StoreNetworkSettingsTable,
              StoreNetworkSetting
            >,
          ),
          StoreNetworkSetting,
          PrefetchHooks Function()
        > {
  $$StoreNetworkSettingsTableTableManager(
    _$RegisterDatabase db,
    $StoreNetworkSettingsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$StoreNetworkSettingsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$StoreNetworkSettingsTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$StoreNetworkSettingsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> mode = const Value.absent(),
                Value<String?> endpoint = const Value.absent(),
                Value<String?> fingerprint = const Value.absent(),
              }) => StoreNetworkSettingsCompanion(
                id: id,
                mode: mode,
                endpoint: endpoint,
                fingerprint: fingerprint,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String mode,
                Value<String?> endpoint = const Value.absent(),
                Value<String?> fingerprint = const Value.absent(),
              }) => StoreNetworkSettingsCompanion.insert(
                id: id,
                mode: mode,
                endpoint: endpoint,
                fingerprint: fingerprint,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$StoreNetworkSettingsTable, StoreNetworkSetting>(
                    table,
                  ),
                  BaseReferences<
                    _$RegisterDatabase,
                    $StoreNetworkSettingsTable,
                    StoreNetworkSetting
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$StoreNetworkSettingsTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $StoreNetworkSettingsTable,
      StoreNetworkSetting,
      $$StoreNetworkSettingsTableFilterComposer,
      $$StoreNetworkSettingsTableOrderingComposer,
      $$StoreNetworkSettingsTableAnnotationComposer,
      $$StoreNetworkSettingsTableCreateCompanionBuilder,
      $$StoreNetworkSettingsTableUpdateCompanionBuilder,
      (
        StoreNetworkSetting,
        BaseReferences<
          _$RegisterDatabase,
          $StoreNetworkSettingsTable,
          StoreNetworkSetting
        >,
      ),
      StoreNetworkSetting,
      PrefetchHooks Function()
    >;
typedef $$StoreDevicesTableCreateCompanionBuilder =
    StoreDevicesCompanion Function({
      required String id,
      Value<String?> profileId,
      required String name,
      required String credentialHash,
      required DateTime pairedAt,
      Value<DateTime?> revokedAt,
      Value<int> rowid,
    });
typedef $$StoreDevicesTableUpdateCompanionBuilder =
    StoreDevicesCompanion Function({
      Value<String> id,
      Value<String?> profileId,
      Value<String> name,
      Value<String> credentialHash,
      Value<DateTime> pairedAt,
      Value<DateTime?> revokedAt,
      Value<int> rowid,
    });

final class $$StoreDevicesTableReferences
    extends
        BaseReferences<_$RegisterDatabase, $StoreDevicesTable, StoreDevice> {
  $$StoreDevicesTableReferences(super.$_db, super.$_table, super.$_typedResult);

  static MultiTypedResultKey<$StoreStaffGrantsTable, List<StoreStaffGrant>>
  _storeStaffGrantsRefsTable(_$RegisterDatabase db) =>
      MultiTypedResultKey.fromTable(
        db.storeStaffGrants,
        aliasName: 'store_devices__id__store_staff_grants__device_id',
      );

  $$StoreStaffGrantsTableProcessedTableManager get storeStaffGrantsRefs {
    final manager = $$StoreStaffGrantsTableTableManager(
      $_db,
      $_db.storeStaffGrants,
    ).filter((f) => f.deviceId.id.sqlEquals($_itemColumn<String>('id')!));

    final cache = $_typedResult.readTableOrNull(
      _storeStaffGrantsRefsTable($_db),
    );
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: cache),
    );
  }
}

class $$StoreDevicesTableFilterComposer
    extends Composer<_$RegisterDatabase, $StoreDevicesTable> {
  $$StoreDevicesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get credentialHash => $composableBuilder(
    column: $table.credentialHash,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get pairedAt => $composableBuilder(
    column: $table.pairedAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get revokedAt => $composableBuilder(
    column: $table.revokedAt,
    builder: (column) => ColumnFilters(column),
  );

  Expression<bool> storeStaffGrantsRefs(
    Expression<bool> Function($$StoreStaffGrantsTableFilterComposer f) f,
  ) {
    final $$StoreStaffGrantsTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.storeStaffGrants,
      getReferencedColumn: (t) => t.deviceId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$StoreStaffGrantsTableFilterComposer(
            $db: $db,
            $table: $db.storeStaffGrants,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$StoreDevicesTableOrderingComposer
    extends Composer<_$RegisterDatabase, $StoreDevicesTable> {
  $$StoreDevicesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get name => $composableBuilder(
    column: $table.name,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get credentialHash => $composableBuilder(
    column: $table.credentialHash,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get pairedAt => $composableBuilder(
    column: $table.pairedAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get revokedAt => $composableBuilder(
    column: $table.revokedAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$StoreDevicesTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $StoreDevicesTable> {
  $$StoreDevicesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get profileId =>
      $composableBuilder(column: $table.profileId, builder: (column) => column);

  GeneratedColumn<String> get name =>
      $composableBuilder(column: $table.name, builder: (column) => column);

  GeneratedColumn<String> get credentialHash => $composableBuilder(
    column: $table.credentialHash,
    builder: (column) => column,
  );

  GeneratedColumn<DateTime> get pairedAt =>
      $composableBuilder(column: $table.pairedAt, builder: (column) => column);

  GeneratedColumn<DateTime> get revokedAt =>
      $composableBuilder(column: $table.revokedAt, builder: (column) => column);

  Expression<T> storeStaffGrantsRefs<T extends Object>(
    Expression<T> Function($$StoreStaffGrantsTableAnnotationComposer a) f,
  ) {
    final $$StoreStaffGrantsTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.id,
      referencedTable: $db.storeStaffGrants,
      getReferencedColumn: (t) => t.deviceId,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$StoreStaffGrantsTableAnnotationComposer(
            $db: $db,
            $table: $db.storeStaffGrants,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return f(composer);
  }
}

class $$StoreDevicesTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $StoreDevicesTable,
          StoreDevice,
          $$StoreDevicesTableFilterComposer,
          $$StoreDevicesTableOrderingComposer,
          $$StoreDevicesTableAnnotationComposer,
          $$StoreDevicesTableCreateCompanionBuilder,
          $$StoreDevicesTableUpdateCompanionBuilder,
          (StoreDevice, $$StoreDevicesTableReferences),
          StoreDevice,
          PrefetchHooks Function({bool storeStaffGrantsRefs})
        > {
  $$StoreDevicesTableTableManager(
    _$RegisterDatabase db,
    $StoreDevicesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$StoreDevicesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$StoreDevicesTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$StoreDevicesTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> id = const Value.absent(),
                Value<String?> profileId = const Value.absent(),
                Value<String> name = const Value.absent(),
                Value<String> credentialHash = const Value.absent(),
                Value<DateTime> pairedAt = const Value.absent(),
                Value<DateTime?> revokedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => StoreDevicesCompanion(
                id: id,
                profileId: profileId,
                name: name,
                credentialHash: credentialHash,
                pairedAt: pairedAt,
                revokedAt: revokedAt,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String id,
                Value<String?> profileId = const Value.absent(),
                required String name,
                required String credentialHash,
                required DateTime pairedAt,
                Value<DateTime?> revokedAt = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => StoreDevicesCompanion.insert(
                id: id,
                profileId: profileId,
                name: name,
                credentialHash: credentialHash,
                pairedAt: pairedAt,
                revokedAt: revokedAt,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$StoreDevicesTable, StoreDevice>(table),
                  $$StoreDevicesTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({storeStaffGrantsRefs = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [
                if (storeStaffGrantsRefs) db.storeStaffGrants,
              ],
              addJoins: null,
              getPrefetchedDataCallback: (items) async {
                return [
                  if (storeStaffGrantsRefs)
                    await $_getPrefetchedDataByColumns<
                      StoreDevice,
                      $StoreDevicesTable,
                      StoreStaffGrant,
                      $StoreStaffGrantsTable
                    >(
                      currentTable: table,
                      referencedTable: $$StoreDevicesTableReferences
                          ._storeStaffGrantsRefsTable(db),
                      managerFromTypedResult: (p0) =>
                          $$StoreDevicesTableReferences(
                            db,
                            table,
                            p0,
                          ).storeStaffGrantsRefs,
                      currentColumn: 'id',
                      referencedColumn: 'device_id',
                      typedResults: items,
                    ),
                ];
              },
            );
          },
        ),
      );
}

typedef $$StoreDevicesTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $StoreDevicesTable,
      StoreDevice,
      $$StoreDevicesTableFilterComposer,
      $$StoreDevicesTableOrderingComposer,
      $$StoreDevicesTableAnnotationComposer,
      $$StoreDevicesTableCreateCompanionBuilder,
      $$StoreDevicesTableUpdateCompanionBuilder,
      (StoreDevice, $$StoreDevicesTableReferences),
      StoreDevice,
      PrefetchHooks Function({bool storeStaffGrantsRefs})
    >;
typedef $$StoreStaffGrantsTableCreateCompanionBuilder =
    StoreStaffGrantsCompanion Function({
      required String deviceId,
      required String operatorId,
      required String displayName,
      required String role,
      required String credentialHash,
      Value<int> rowid,
    });
typedef $$StoreStaffGrantsTableUpdateCompanionBuilder =
    StoreStaffGrantsCompanion Function({
      Value<String> deviceId,
      Value<String> operatorId,
      Value<String> displayName,
      Value<String> role,
      Value<String> credentialHash,
      Value<int> rowid,
    });

final class $$StoreStaffGrantsTableReferences
    extends
        BaseReferences<
          _$RegisterDatabase,
          $StoreStaffGrantsTable,
          StoreStaffGrant
        > {
  $$StoreStaffGrantsTableReferences(
    super.$_db,
    super.$_table,
    super.$_typedResult,
  );

  static $StoreDevicesTable _deviceIdTable(_$RegisterDatabase db) => db
      .storeDevices
      .createAlias('store_staff_grants__device_id__store_devices__id');

  $$StoreDevicesTableProcessedTableManager get deviceId {
    final $_column = $_itemColumn<String>('device_id')!;

    final manager = $$StoreDevicesTableTableManager(
      $_db,
      $_db.storeDevices,
    ).filter((f) => f.id.sqlEquals($_column));
    final item = $_typedResult.readTableOrNull(_deviceIdTable($_db));
    if (item == null) return manager;
    return ProcessedTableManager(
      manager.$state.copyWith(prefetchedData: [item]),
    );
  }
}

class $$StoreStaffGrantsTableFilterComposer
    extends Composer<_$RegisterDatabase, $StoreStaffGrantsTable> {
  $$StoreStaffGrantsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get displayName => $composableBuilder(
    column: $table.displayName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get role => $composableBuilder(
    column: $table.role,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get credentialHash => $composableBuilder(
    column: $table.credentialHash,
    builder: (column) => ColumnFilters(column),
  );

  $$StoreDevicesTableFilterComposer get deviceId {
    final $$StoreDevicesTableFilterComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.deviceId,
      referencedTable: $db.storeDevices,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$StoreDevicesTableFilterComposer(
            $db: $db,
            $table: $db.storeDevices,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$StoreStaffGrantsTableOrderingComposer
    extends Composer<_$RegisterDatabase, $StoreStaffGrantsTable> {
  $$StoreStaffGrantsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get displayName => $composableBuilder(
    column: $table.displayName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get role => $composableBuilder(
    column: $table.role,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get credentialHash => $composableBuilder(
    column: $table.credentialHash,
    builder: (column) => ColumnOrderings(column),
  );

  $$StoreDevicesTableOrderingComposer get deviceId {
    final $$StoreDevicesTableOrderingComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.deviceId,
      referencedTable: $db.storeDevices,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$StoreDevicesTableOrderingComposer(
            $db: $db,
            $table: $db.storeDevices,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$StoreStaffGrantsTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $StoreStaffGrantsTable> {
  $$StoreStaffGrantsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get displayName => $composableBuilder(
    column: $table.displayName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get role =>
      $composableBuilder(column: $table.role, builder: (column) => column);

  GeneratedColumn<String> get credentialHash => $composableBuilder(
    column: $table.credentialHash,
    builder: (column) => column,
  );

  $$StoreDevicesTableAnnotationComposer get deviceId {
    final $$StoreDevicesTableAnnotationComposer composer = $composerBuilder(
      composer: this,
      getCurrentColumn: (t) => t.deviceId,
      referencedTable: $db.storeDevices,
      getReferencedColumn: (t) => t.id,
      builder:
          (
            joinBuilder, {
            $addJoinBuilderToRootComposer,
            $removeJoinBuilderFromRootComposer,
          }) => $$StoreDevicesTableAnnotationComposer(
            $db: $db,
            $table: $db.storeDevices,
            $addJoinBuilderToRootComposer: $addJoinBuilderToRootComposer,
            joinBuilder: joinBuilder,
            $removeJoinBuilderFromRootComposer:
                $removeJoinBuilderFromRootComposer,
          ),
    );
    return composer;
  }
}

class $$StoreStaffGrantsTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $StoreStaffGrantsTable,
          StoreStaffGrant,
          $$StoreStaffGrantsTableFilterComposer,
          $$StoreStaffGrantsTableOrderingComposer,
          $$StoreStaffGrantsTableAnnotationComposer,
          $$StoreStaffGrantsTableCreateCompanionBuilder,
          $$StoreStaffGrantsTableUpdateCompanionBuilder,
          (StoreStaffGrant, $$StoreStaffGrantsTableReferences),
          StoreStaffGrant,
          PrefetchHooks Function({bool deviceId})
        > {
  $$StoreStaffGrantsTableTableManager(
    _$RegisterDatabase db,
    $StoreStaffGrantsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$StoreStaffGrantsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$StoreStaffGrantsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$StoreStaffGrantsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> deviceId = const Value.absent(),
                Value<String> operatorId = const Value.absent(),
                Value<String> displayName = const Value.absent(),
                Value<String> role = const Value.absent(),
                Value<String> credentialHash = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => StoreStaffGrantsCompanion(
                deviceId: deviceId,
                operatorId: operatorId,
                displayName: displayName,
                role: role,
                credentialHash: credentialHash,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String deviceId,
                required String operatorId,
                required String displayName,
                required String role,
                required String credentialHash,
                Value<int> rowid = const Value.absent(),
              }) => StoreStaffGrantsCompanion.insert(
                deviceId: deviceId,
                operatorId: operatorId,
                displayName: displayName,
                role: role,
                credentialHash: credentialHash,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$StoreStaffGrantsTable, StoreStaffGrant>(table),
                  $$StoreStaffGrantsTableReferences(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: ({deviceId = false}) {
            return PrefetchHooks(
              db: db,
              explicitlyWatchedTables: [],
              addJoins:
                  <
                    T extends TableManagerState<
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic,
                      dynamic
                    >
                  >(state) {
                    if (deviceId) {
                      state = state.withJoin(
                        currentTable: table,
                        currentColumn: table.deviceId,
                        referencedTable: $$StoreStaffGrantsTableReferences
                            ._deviceIdTable(db),
                        referencedColumn: $$StoreStaffGrantsTableReferences
                            ._deviceIdTable(db)
                            .id,
                      ) as T;
                    }

                    return state;
                  },
              getPrefetchedDataCallback: (items) async {
                return [];
              },
            );
          },
        ),
      );
}

typedef $$StoreStaffGrantsTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $StoreStaffGrantsTable,
      StoreStaffGrant,
      $$StoreStaffGrantsTableFilterComposer,
      $$StoreStaffGrantsTableOrderingComposer,
      $$StoreStaffGrantsTableAnnotationComposer,
      $$StoreStaffGrantsTableCreateCompanionBuilder,
      $$StoreStaffGrantsTableUpdateCompanionBuilder,
      (StoreStaffGrant, $$StoreStaffGrantsTableReferences),
      StoreStaffGrant,
      PrefetchHooks Function({bool deviceId})
    >;
typedef $$TillCommandsTableCreateCompanionBuilder =
    TillCommandsCompanion Function({
      required String operatorId,
      required String commandId,
      required String action,
      required String payload,
      Value<int> rowid,
    });
typedef $$TillCommandsTableUpdateCompanionBuilder =
    TillCommandsCompanion Function({
      Value<String> operatorId,
      Value<String> commandId,
      Value<String> action,
      Value<String> payload,
      Value<int> rowid,
    });

class $$TillCommandsTableFilterComposer
    extends Composer<_$RegisterDatabase, $TillCommandsTable> {
  $$TillCommandsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get commandId => $composableBuilder(
    column: $table.commandId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get action => $composableBuilder(
    column: $table.action,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnFilters(column),
  );
}

class $$TillCommandsTableOrderingComposer
    extends Composer<_$RegisterDatabase, $TillCommandsTable> {
  $$TillCommandsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get commandId => $composableBuilder(
    column: $table.commandId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get action => $composableBuilder(
    column: $table.action,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get payload => $composableBuilder(
    column: $table.payload,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$TillCommandsTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $TillCommandsTable> {
  $$TillCommandsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get commandId =>
      $composableBuilder(column: $table.commandId, builder: (column) => column);

  GeneratedColumn<String> get action =>
      $composableBuilder(column: $table.action, builder: (column) => column);

  GeneratedColumn<String> get payload =>
      $composableBuilder(column: $table.payload, builder: (column) => column);
}

class $$TillCommandsTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $TillCommandsTable,
          TillCommand,
          $$TillCommandsTableFilterComposer,
          $$TillCommandsTableOrderingComposer,
          $$TillCommandsTableAnnotationComposer,
          $$TillCommandsTableCreateCompanionBuilder,
          $$TillCommandsTableUpdateCompanionBuilder,
          (
            TillCommand,
            BaseReferences<_$RegisterDatabase, $TillCommandsTable, TillCommand>,
          ),
          TillCommand,
          PrefetchHooks Function()
        > {
  $$TillCommandsTableTableManager(
    _$RegisterDatabase db,
    $TillCommandsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$TillCommandsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$TillCommandsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$TillCommandsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<String> operatorId = const Value.absent(),
                Value<String> commandId = const Value.absent(),
                Value<String> action = const Value.absent(),
                Value<String> payload = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => TillCommandsCompanion(
                operatorId: operatorId,
                commandId: commandId,
                action: action,
                payload: payload,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String operatorId,
                required String commandId,
                required String action,
                required String payload,
                Value<int> rowid = const Value.absent(),
              }) => TillCommandsCompanion.insert(
                operatorId: operatorId,
                commandId: commandId,
                action: action,
                payload: payload,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$TillCommandsTable, TillCommand>(table),
                  BaseReferences<
                    _$RegisterDatabase,
                    $TillCommandsTable,
                    TillCommand
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$TillCommandsTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $TillCommandsTable,
      TillCommand,
      $$TillCommandsTableFilterComposer,
      $$TillCommandsTableOrderingComposer,
      $$TillCommandsTableAnnotationComposer,
      $$TillCommandsTableCreateCompanionBuilder,
      $$TillCommandsTableUpdateCompanionBuilder,
      (
        TillCommand,
        BaseReferences<_$RegisterDatabase, $TillCommandsTable, TillCommand>,
      ),
      TillCommand,
      PrefetchHooks Function()
    >;
typedef $$ReceiptPrintsTableCreateCompanionBuilder =
    ReceiptPrintsCompanion Function({
      Value<int> id,
      required String saleId,
      required String operatorId,
      required int copies,
      required DateTime sentAt,
    });
typedef $$ReceiptPrintsTableUpdateCompanionBuilder =
    ReceiptPrintsCompanion Function({
      Value<int> id,
      Value<String> saleId,
      Value<String> operatorId,
      Value<int> copies,
      Value<DateTime> sentAt,
    });

class $$ReceiptPrintsTableFilterComposer
    extends Composer<_$RegisterDatabase, $ReceiptPrintsTable> {
  $$ReceiptPrintsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get saleId => $composableBuilder(
    column: $table.saleId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get copies => $composableBuilder(
    column: $table.copies,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get sentAt => $composableBuilder(
    column: $table.sentAt,
    builder: (column) => ColumnFilters(column),
  );
}

class $$ReceiptPrintsTableOrderingComposer
    extends Composer<_$RegisterDatabase, $ReceiptPrintsTable> {
  $$ReceiptPrintsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get saleId => $composableBuilder(
    column: $table.saleId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get copies => $composableBuilder(
    column: $table.copies,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get sentAt => $composableBuilder(
    column: $table.sentAt,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$ReceiptPrintsTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $ReceiptPrintsTable> {
  $$ReceiptPrintsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get saleId =>
      $composableBuilder(column: $table.saleId, builder: (column) => column);

  GeneratedColumn<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => column,
  );

  GeneratedColumn<int> get copies =>
      $composableBuilder(column: $table.copies, builder: (column) => column);

  GeneratedColumn<DateTime> get sentAt =>
      $composableBuilder(column: $table.sentAt, builder: (column) => column);
}

class $$ReceiptPrintsTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $ReceiptPrintsTable,
          ReceiptPrint,
          $$ReceiptPrintsTableFilterComposer,
          $$ReceiptPrintsTableOrderingComposer,
          $$ReceiptPrintsTableAnnotationComposer,
          $$ReceiptPrintsTableCreateCompanionBuilder,
          $$ReceiptPrintsTableUpdateCompanionBuilder,
          (
            ReceiptPrint,
            BaseReferences<
              _$RegisterDatabase,
              $ReceiptPrintsTable,
              ReceiptPrint
            >,
          ),
          ReceiptPrint,
          PrefetchHooks Function()
        > {
  $$ReceiptPrintsTableTableManager(
    _$RegisterDatabase db,
    $ReceiptPrintsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$ReceiptPrintsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$ReceiptPrintsTableOrderingComposer($db: db, $table: table),
          createComputedFieldComposer: () =>
              $$ReceiptPrintsTableAnnotationComposer($db: db, $table: table),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> saleId = const Value.absent(),
                Value<String> operatorId = const Value.absent(),
                Value<int> copies = const Value.absent(),
                Value<DateTime> sentAt = const Value.absent(),
              }) => ReceiptPrintsCompanion(
                id: id,
                saleId: saleId,
                operatorId: operatorId,
                copies: copies,
                sentAt: sentAt,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String saleId,
                required String operatorId,
                required int copies,
                required DateTime sentAt,
              }) => ReceiptPrintsCompanion.insert(
                id: id,
                saleId: saleId,
                operatorId: operatorId,
                copies: copies,
                sentAt: sentAt,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$ReceiptPrintsTable, ReceiptPrint>(table),
                  BaseReferences<
                    _$RegisterDatabase,
                    $ReceiptPrintsTable,
                    ReceiptPrint
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$ReceiptPrintsTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $ReceiptPrintsTable,
      ReceiptPrint,
      $$ReceiptPrintsTableFilterComposer,
      $$ReceiptPrintsTableOrderingComposer,
      $$ReceiptPrintsTableAnnotationComposer,
      $$ReceiptPrintsTableCreateCompanionBuilder,
      $$ReceiptPrintsTableUpdateCompanionBuilder,
      (
        ReceiptPrint,
        BaseReferences<_$RegisterDatabase, $ReceiptPrintsTable, ReceiptPrint>,
      ),
      ReceiptPrint,
      PrefetchHooks Function()
    >;
typedef $$StoreOperatingStatesTableCreateCompanionBuilder =
    StoreOperatingStatesCompanion Function({
      Value<int> id,
      required String epoch,
      required String timezone,
      Value<int> sequence,
      Value<String> phase,
      Value<String> activity,
    });
typedef $$StoreOperatingStatesTableUpdateCompanionBuilder =
    StoreOperatingStatesCompanion Function({
      Value<int> id,
      Value<String> epoch,
      Value<String> timezone,
      Value<int> sequence,
      Value<String> phase,
      Value<String> activity,
    });

class $$StoreOperatingStatesTableFilterComposer
    extends Composer<_$RegisterDatabase, $StoreOperatingStatesTable> {
  $$StoreOperatingStatesTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get epoch => $composableBuilder(
    column: $table.epoch,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get timezone => $composableBuilder(
    column: $table.timezone,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get sequence => $composableBuilder(
    column: $table.sequence,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get phase => $composableBuilder(
    column: $table.phase,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get activity => $composableBuilder(
    column: $table.activity,
    builder: (column) => ColumnFilters(column),
  );
}

class $$StoreOperatingStatesTableOrderingComposer
    extends Composer<_$RegisterDatabase, $StoreOperatingStatesTable> {
  $$StoreOperatingStatesTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<int> get id => $composableBuilder(
    column: $table.id,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get epoch => $composableBuilder(
    column: $table.epoch,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get timezone => $composableBuilder(
    column: $table.timezone,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get sequence => $composableBuilder(
    column: $table.sequence,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get phase => $composableBuilder(
    column: $table.phase,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get activity => $composableBuilder(
    column: $table.activity,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$StoreOperatingStatesTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $StoreOperatingStatesTable> {
  $$StoreOperatingStatesTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<int> get id =>
      $composableBuilder(column: $table.id, builder: (column) => column);

  GeneratedColumn<String> get epoch =>
      $composableBuilder(column: $table.epoch, builder: (column) => column);

  GeneratedColumn<String> get timezone =>
      $composableBuilder(column: $table.timezone, builder: (column) => column);

  GeneratedColumn<int> get sequence =>
      $composableBuilder(column: $table.sequence, builder: (column) => column);

  GeneratedColumn<String> get phase =>
      $composableBuilder(column: $table.phase, builder: (column) => column);

  GeneratedColumn<String> get activity =>
      $composableBuilder(column: $table.activity, builder: (column) => column);
}

class $$StoreOperatingStatesTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $StoreOperatingStatesTable,
          StoreOperatingState,
          $$StoreOperatingStatesTableFilterComposer,
          $$StoreOperatingStatesTableOrderingComposer,
          $$StoreOperatingStatesTableAnnotationComposer,
          $$StoreOperatingStatesTableCreateCompanionBuilder,
          $$StoreOperatingStatesTableUpdateCompanionBuilder,
          (
            StoreOperatingState,
            BaseReferences<
              _$RegisterDatabase,
              $StoreOperatingStatesTable,
              StoreOperatingState
            >,
          ),
          StoreOperatingState,
          PrefetchHooks Function()
        > {
  $$StoreOperatingStatesTableTableManager(
    _$RegisterDatabase db,
    $StoreOperatingStatesTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$StoreOperatingStatesTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$StoreOperatingStatesTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$StoreOperatingStatesTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                Value<String> epoch = const Value.absent(),
                Value<String> timezone = const Value.absent(),
                Value<int> sequence = const Value.absent(),
                Value<String> phase = const Value.absent(),
                Value<String> activity = const Value.absent(),
              }) => StoreOperatingStatesCompanion(
                id: id,
                epoch: epoch,
                timezone: timezone,
                sequence: sequence,
                phase: phase,
                activity: activity,
              ),
          createCompanionCallback:
              ({
                Value<int> id = const Value.absent(),
                required String epoch,
                required String timezone,
                Value<int> sequence = const Value.absent(),
                Value<String> phase = const Value.absent(),
                Value<String> activity = const Value.absent(),
              }) => StoreOperatingStatesCompanion.insert(
                id: id,
                epoch: epoch,
                timezone: timezone,
                sequence: sequence,
                phase: phase,
                activity: activity,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$StoreOperatingStatesTable, StoreOperatingState>(
                    table,
                  ),
                  BaseReferences<
                    _$RegisterDatabase,
                    $StoreOperatingStatesTable,
                    StoreOperatingState
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$StoreOperatingStatesTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $StoreOperatingStatesTable,
      StoreOperatingState,
      $$StoreOperatingStatesTableFilterComposer,
      $$StoreOperatingStatesTableOrderingComposer,
      $$StoreOperatingStatesTableAnnotationComposer,
      $$StoreOperatingStatesTableCreateCompanionBuilder,
      $$StoreOperatingStatesTableUpdateCompanionBuilder,
      (
        StoreOperatingState,
        BaseReferences<
          _$RegisterDatabase,
          $StoreOperatingStatesTable,
          StoreOperatingState
        >,
      ),
      StoreOperatingState,
      PrefetchHooks Function()
    >;
typedef $$StoreOperatingEventsTableCreateCompanionBuilder =
    StoreOperatingEventsCompanion Function({
      required String epoch,
      required int sequence,
      required String commandId,
      required String resourceId,
      required String operatorId,
      Value<String?> operatorName,
      Value<String?> profileId,
      required String kind,
      required String envelope,
      Value<String> status,
      Value<int> attempts,
      required DateTime retryAt,
      Value<String?> lastError,
      Value<String?> acknowledgment,
      Value<String?> recoveryOwnerId,
      Value<String?> recoveryReason,
      Value<int> rowid,
    });
typedef $$StoreOperatingEventsTableUpdateCompanionBuilder =
    StoreOperatingEventsCompanion Function({
      Value<String> epoch,
      Value<int> sequence,
      Value<String> commandId,
      Value<String> resourceId,
      Value<String> operatorId,
      Value<String?> operatorName,
      Value<String?> profileId,
      Value<String> kind,
      Value<String> envelope,
      Value<String> status,
      Value<int> attempts,
      Value<DateTime> retryAt,
      Value<String?> lastError,
      Value<String?> acknowledgment,
      Value<String?> recoveryOwnerId,
      Value<String?> recoveryReason,
      Value<int> rowid,
    });

class $$StoreOperatingEventsTableFilterComposer
    extends Composer<_$RegisterDatabase, $StoreOperatingEventsTable> {
  $$StoreOperatingEventsTableFilterComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnFilters<String> get epoch => $composableBuilder(
    column: $table.epoch,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get sequence => $composableBuilder(
    column: $table.sequence,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get commandId => $composableBuilder(
    column: $table.commandId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get resourceId => $composableBuilder(
    column: $table.resourceId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get operatorName => $composableBuilder(
    column: $table.operatorName,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get envelope => $composableBuilder(
    column: $table.envelope,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<DateTime> get retryAt => $composableBuilder(
    column: $table.retryAt,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get acknowledgment => $composableBuilder(
    column: $table.acknowledgment,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get recoveryOwnerId => $composableBuilder(
    column: $table.recoveryOwnerId,
    builder: (column) => ColumnFilters(column),
  );

  ColumnFilters<String> get recoveryReason => $composableBuilder(
    column: $table.recoveryReason,
    builder: (column) => ColumnFilters(column),
  );
}

class $$StoreOperatingEventsTableOrderingComposer
    extends Composer<_$RegisterDatabase, $StoreOperatingEventsTable> {
  $$StoreOperatingEventsTableOrderingComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  ColumnOrderings<String> get epoch => $composableBuilder(
    column: $table.epoch,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get sequence => $composableBuilder(
    column: $table.sequence,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get commandId => $composableBuilder(
    column: $table.commandId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get resourceId => $composableBuilder(
    column: $table.resourceId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get operatorName => $composableBuilder(
    column: $table.operatorName,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get profileId => $composableBuilder(
    column: $table.profileId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get kind => $composableBuilder(
    column: $table.kind,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get envelope => $composableBuilder(
    column: $table.envelope,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get status => $composableBuilder(
    column: $table.status,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<int> get attempts => $composableBuilder(
    column: $table.attempts,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<DateTime> get retryAt => $composableBuilder(
    column: $table.retryAt,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get lastError => $composableBuilder(
    column: $table.lastError,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get acknowledgment => $composableBuilder(
    column: $table.acknowledgment,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get recoveryOwnerId => $composableBuilder(
    column: $table.recoveryOwnerId,
    builder: (column) => ColumnOrderings(column),
  );

  ColumnOrderings<String> get recoveryReason => $composableBuilder(
    column: $table.recoveryReason,
    builder: (column) => ColumnOrderings(column),
  );
}

class $$StoreOperatingEventsTableAnnotationComposer
    extends Composer<_$RegisterDatabase, $StoreOperatingEventsTable> {
  $$StoreOperatingEventsTableAnnotationComposer({
    required super.$db,
    required super.$table,
    super.joinBuilder,
    super.$addJoinBuilderToRootComposer,
    super.$removeJoinBuilderFromRootComposer,
  });
  GeneratedColumn<String> get epoch =>
      $composableBuilder(column: $table.epoch, builder: (column) => column);

  GeneratedColumn<int> get sequence =>
      $composableBuilder(column: $table.sequence, builder: (column) => column);

  GeneratedColumn<String> get commandId =>
      $composableBuilder(column: $table.commandId, builder: (column) => column);

  GeneratedColumn<String> get resourceId => $composableBuilder(
    column: $table.resourceId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get operatorId => $composableBuilder(
    column: $table.operatorId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get operatorName => $composableBuilder(
    column: $table.operatorName,
    builder: (column) => column,
  );

  GeneratedColumn<String> get profileId =>
      $composableBuilder(column: $table.profileId, builder: (column) => column);

  GeneratedColumn<String> get kind =>
      $composableBuilder(column: $table.kind, builder: (column) => column);

  GeneratedColumn<String> get envelope =>
      $composableBuilder(column: $table.envelope, builder: (column) => column);

  GeneratedColumn<String> get status =>
      $composableBuilder(column: $table.status, builder: (column) => column);

  GeneratedColumn<int> get attempts =>
      $composableBuilder(column: $table.attempts, builder: (column) => column);

  GeneratedColumn<DateTime> get retryAt =>
      $composableBuilder(column: $table.retryAt, builder: (column) => column);

  GeneratedColumn<String> get lastError =>
      $composableBuilder(column: $table.lastError, builder: (column) => column);

  GeneratedColumn<String> get acknowledgment => $composableBuilder(
    column: $table.acknowledgment,
    builder: (column) => column,
  );

  GeneratedColumn<String> get recoveryOwnerId => $composableBuilder(
    column: $table.recoveryOwnerId,
    builder: (column) => column,
  );

  GeneratedColumn<String> get recoveryReason => $composableBuilder(
    column: $table.recoveryReason,
    builder: (column) => column,
  );
}

class $$StoreOperatingEventsTableTableManager
    extends
        RootTableManager<
          _$RegisterDatabase,
          $StoreOperatingEventsTable,
          StoreOperatingEvent,
          $$StoreOperatingEventsTableFilterComposer,
          $$StoreOperatingEventsTableOrderingComposer,
          $$StoreOperatingEventsTableAnnotationComposer,
          $$StoreOperatingEventsTableCreateCompanionBuilder,
          $$StoreOperatingEventsTableUpdateCompanionBuilder,
          (
            StoreOperatingEvent,
            BaseReferences<
              _$RegisterDatabase,
              $StoreOperatingEventsTable,
              StoreOperatingEvent
            >,
          ),
          StoreOperatingEvent,
          PrefetchHooks Function()
        > {
  $$StoreOperatingEventsTableTableManager(
    _$RegisterDatabase db,
    $StoreOperatingEventsTable table,
  ) : super(
        TableManagerState(
          db: db,
          table: table,
          createFilteringComposer: () =>
              $$StoreOperatingEventsTableFilterComposer($db: db, $table: table),
          createOrderingComposer: () =>
              $$StoreOperatingEventsTableOrderingComposer(
                $db: db,
                $table: table,
              ),
          createComputedFieldComposer: () =>
              $$StoreOperatingEventsTableAnnotationComposer(
                $db: db,
                $table: table,
              ),
          updateCompanionCallback:
              ({
                Value<String> epoch = const Value.absent(),
                Value<int> sequence = const Value.absent(),
                Value<String> commandId = const Value.absent(),
                Value<String> resourceId = const Value.absent(),
                Value<String> operatorId = const Value.absent(),
                Value<String?> operatorName = const Value.absent(),
                Value<String?> profileId = const Value.absent(),
                Value<String> kind = const Value.absent(),
                Value<String> envelope = const Value.absent(),
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                Value<DateTime> retryAt = const Value.absent(),
                Value<String?> lastError = const Value.absent(),
                Value<String?> acknowledgment = const Value.absent(),
                Value<String?> recoveryOwnerId = const Value.absent(),
                Value<String?> recoveryReason = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => StoreOperatingEventsCompanion(
                epoch: epoch,
                sequence: sequence,
                commandId: commandId,
                resourceId: resourceId,
                operatorId: operatorId,
                operatorName: operatorName,
                profileId: profileId,
                kind: kind,
                envelope: envelope,
                status: status,
                attempts: attempts,
                retryAt: retryAt,
                lastError: lastError,
                acknowledgment: acknowledgment,
                recoveryOwnerId: recoveryOwnerId,
                recoveryReason: recoveryReason,
                rowid: rowid,
              ),
          createCompanionCallback:
              ({
                required String epoch,
                required int sequence,
                required String commandId,
                required String resourceId,
                required String operatorId,
                Value<String?> operatorName = const Value.absent(),
                Value<String?> profileId = const Value.absent(),
                required String kind,
                required String envelope,
                Value<String> status = const Value.absent(),
                Value<int> attempts = const Value.absent(),
                required DateTime retryAt,
                Value<String?> lastError = const Value.absent(),
                Value<String?> acknowledgment = const Value.absent(),
                Value<String?> recoveryOwnerId = const Value.absent(),
                Value<String?> recoveryReason = const Value.absent(),
                Value<int> rowid = const Value.absent(),
              }) => StoreOperatingEventsCompanion.insert(
                epoch: epoch,
                sequence: sequence,
                commandId: commandId,
                resourceId: resourceId,
                operatorId: operatorId,
                operatorName: operatorName,
                profileId: profileId,
                kind: kind,
                envelope: envelope,
                status: status,
                attempts: attempts,
                retryAt: retryAt,
                lastError: lastError,
                acknowledgment: acknowledgment,
                recoveryOwnerId: recoveryOwnerId,
                recoveryReason: recoveryReason,
                rowid: rowid,
              ),
          withReferenceMapper: (p0) => p0
              .map(
                (e) => (
                  e.readTable<$StoreOperatingEventsTable, StoreOperatingEvent>(
                    table,
                  ),
                  BaseReferences<
                    _$RegisterDatabase,
                    $StoreOperatingEventsTable,
                    StoreOperatingEvent
                  >(db, table, e),
                ),
              )
              .toList(),
          prefetchHooksCallback: null,
        ),
      );
}

typedef $$StoreOperatingEventsTableProcessedTableManager =
    ProcessedTableManager<
      _$RegisterDatabase,
      $StoreOperatingEventsTable,
      StoreOperatingEvent,
      $$StoreOperatingEventsTableFilterComposer,
      $$StoreOperatingEventsTableOrderingComposer,
      $$StoreOperatingEventsTableAnnotationComposer,
      $$StoreOperatingEventsTableCreateCompanionBuilder,
      $$StoreOperatingEventsTableUpdateCompanionBuilder,
      (
        StoreOperatingEvent,
        BaseReferences<
          _$RegisterDatabase,
          $StoreOperatingEventsTable,
          StoreOperatingEvent
        >,
      ),
      StoreOperatingEvent,
      PrefetchHooks Function()
    >;

class $RegisterDatabaseManager {
  final _$RegisterDatabase _db;
  $RegisterDatabaseManager(this._db);
  $$RegisterInstallationsTableTableManager get registerInstallations =>
      $$RegisterInstallationsTableTableManager(_db, _db.registerInstallations);
  $$RegisterOperatorsTableTableManager get registerOperators =>
      $$RegisterOperatorsTableTableManager(_db, _db.registerOperators);
  $$ProfileSnapshotsTableTableManager get profileSnapshots =>
      $$ProfileSnapshotsTableTableManager(_db, _db.profileSnapshots);
  $$LocalSalesTableTableManager get localSales =>
      $$LocalSalesTableTableManager(_db, _db.localSales);
  $$SaleOutboxTableTableManager get saleOutbox =>
      $$SaleOutboxTableTableManager(_db, _db.saleOutbox);
  $$HeldBillsTableTableManager get heldBills =>
      $$HeldBillsTableTableManager(_db, _db.heldBills);
  $$RegisterCartDraftsTableTableManager get registerCartDrafts =>
      $$RegisterCartDraftsTableTableManager(_db, _db.registerCartDrafts);
  $$RegisterCommandsTableTableManager get registerCommands =>
      $$RegisterCommandsTableTableManager(_db, _db.registerCommands);
  $$StoreNetworkSettingsTableTableManager get storeNetworkSettings =>
      $$StoreNetworkSettingsTableTableManager(_db, _db.storeNetworkSettings);
  $$StoreDevicesTableTableManager get storeDevices =>
      $$StoreDevicesTableTableManager(_db, _db.storeDevices);
  $$StoreStaffGrantsTableTableManager get storeStaffGrants =>
      $$StoreStaffGrantsTableTableManager(_db, _db.storeStaffGrants);
  $$TillCommandsTableTableManager get tillCommands =>
      $$TillCommandsTableTableManager(_db, _db.tillCommands);
  $$ReceiptPrintsTableTableManager get receiptPrints =>
      $$ReceiptPrintsTableTableManager(_db, _db.receiptPrints);
  $$StoreOperatingStatesTableTableManager get storeOperatingStates =>
      $$StoreOperatingStatesTableTableManager(_db, _db.storeOperatingStates);
  $$StoreOperatingEventsTableTableManager get storeOperatingEvents =>
      $$StoreOperatingEventsTableTableManager(_db, _db.storeOperatingEvents);
}
