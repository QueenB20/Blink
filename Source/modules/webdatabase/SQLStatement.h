/*
 * Copyright (C) 2007, 2013 Apple Inc. All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions
 * are met:
 *
 * 1.  Redistributions of source code must retain the above copyright
 *     notice, this list of conditions and the following disclaimer.
 * 2.  Redistributions in binary form must reproduce the above copyright
 *     notice, this list of conditions and the following disclaimer in the
 *     documentation and/or other materials provided with the distribution.
 * 3.  Neither the name of Apple Computer, Inc. ("Apple") nor the names of
 *     its contributors may be used to endorse or promote products derived
 *     from this software without specific prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY APPLE AND ITS CONTRIBUTORS "AS IS" AND ANY
 * EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE IMPLIED
 * WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL APPLE OR ITS CONTRIBUTORS BE LIABLE FOR ANY
 * DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES
 * (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES;
 * LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND
 * ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
 * (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE OF
 * THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
#ifndef SQLStatement_h
#define SQLStatement_h

#include "modules/webdatabase/sqlite/SQLValue.h"
#include "modules/webdatabase/SQLResultSet.h"
#include "wtf/Forward.h"
#include "wtf/text/WTFString.h"

namespace blink {

class Database;
class SQLError;
class SQLStatementBackend;
class SQLStatementCallback;
class SQLStatementErrorCallback;
class SQLTransaction;

class SQLStatement final : public GarbageCollectedFinalized<SQLStatement> {
public:
    static SQLStatement* create(Database*, SQLStatementCallback*, SQLStatementErrorCallback*);
    ~SQLStatement();
    void trace(Visitor*);

    bool performCallback(SQLTransaction*);

    void setBackend(SQLStatementBackend*);

    bool hasCallback();
    bool hasErrorCallback();

private:
    SQLStatement(Database*, SQLStatementCallback*, SQLStatementErrorCallback*);

    // The SQLStatementBackend owns the SQLStatement. Hence, the backend is
    // guaranteed to be outlive the SQLStatement, and it is safe for us to refer
    // to the backend using a raw pointer here.
    Member<SQLStatementBackend> m_backend;

    Member<SQLStatementCallback> m_statementCallback;
    Member<SQLStatementErrorCallback> m_statementErrorCallback;
    int m_asyncOperationId;
};

} // namespace blink

#endif // SQLStatement_h
